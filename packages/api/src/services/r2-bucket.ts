import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import type {
  R2Checksums,
  R2Conditional,
  R2GetOptions,
  R2HTTPMetadata,
  R2ListOptions,
  R2MultipartOptions,
  R2MultipartUpload,
  R2Object,
  R2ObjectBody,
  R2Objects,
  R2PutOptions,
  R2Range,
  R2UploadedPart,
} from "@cloudflare/workers-types";
import type { Readable } from "node:stream";

interface R2BucketConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export class R2BucketService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(config: R2BucketConfig) {
    this.bucketName = config.bucketName;
    this.s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async head(key: string): Promise<R2Object | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      return this.createR2Object(key, response);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "name" in error) {
        if (
          error.name === "NotFound" ||
          (error as any).$metadata?.httpStatusCode === 404
        ) {
          return null;
        }
      }
      throw error;
    }
  }

  get(
    key: string,
    options: R2GetOptions & { onlyIf: R2Conditional | Headers }
  ): Promise<R2ObjectBody | R2Object | null>;
  get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null>;
  async get(
    key: string,
    options?: R2GetOptions
  ): Promise<R2ObjectBody | R2Object | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Range: options?.range ? this.formatRange(options.range) : undefined,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        return null;
      }

      const stream = response.Body as Readable;
      const chunks: Uint8Array[] = [];

      // Collect all chunks
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const bodyArray = new Uint8Array(
        chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      );
      let offset = 0;
      for (const chunk of chunks) {
        bodyArray.set(chunk, offset);
        offset += chunk.length;
      }

      const r2Object = this.createR2Object(key, response);

      // Create a proper R2ObjectBody
      const objectBody: R2ObjectBody = {
        ...r2Object,
        get body(): ReadableStream {
          return new ReadableStream({
            start(controller) {
              controller.enqueue(bodyArray);
              controller.close();
            },
          });
        },
        get bodyUsed(): boolean {
          return false;
        },
        arrayBuffer: async () => bodyArray.buffer,
        bytes: async () => bodyArray,
        text: async () => new TextDecoder().decode(bodyArray),
        json: async <T>() =>
          JSON.parse(new TextDecoder().decode(bodyArray)) as T,
        blob: async () => new Blob([bodyArray]),
      };

      return objectBody;
    } catch (error: unknown) {
      if (error && typeof error === "object" && "name" in error) {
        if (
          error.name === "NoSuchKey" ||
          (error as any).$metadata?.httpStatusCode === 404
        ) {
          return null;
        }
      }
      throw error;
    }
  }

  async list(options?: R2ListOptions): Promise<R2Objects> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: options?.limit || 1000,
        Prefix: options?.prefix,
        ContinuationToken: options?.cursor,
        Delimiter: options?.delimiter,
        StartAfter: options?.startAfter,
      });

      const response = await this.s3Client.send(command);

      const objects = (response.Contents || []).map((obj) =>
        this.createR2Object(obj.Key || "", {
          ContentLength: obj.Size,
          ETag: obj.ETag,
          LastModified: obj.LastModified,
          StorageClass: obj.StorageClass,
        })
      );

      // Return proper R2Objects type
      if (response.IsTruncated && response.NextContinuationToken) {
        return {
          objects,
          truncated: true,
          cursor: response.NextContinuationToken,
          delimitedPrefixes:
            response.CommonPrefixes?.map((p) => p.Prefix || "") || [],
        };
      } else {
        return {
          objects,
          truncated: false,
          delimitedPrefixes:
            response.CommonPrefixes?.map((p) => p.Prefix || "") || [],
        };
      }
    } catch (error) {
      console.error("Error listing objects:", error);
      throw error;
    }
  }

  put(
    key: string,
    value:
      | ReadableStream
      | ArrayBuffer
      | ArrayBufferView
      | string
      | null
      | Blob,
    options?: R2PutOptions & { onlyIf: R2Conditional | Headers }
  ): Promise<R2Object | null>;
  put(
    key: string,
    value:
      | ReadableStream
      | ArrayBuffer
      | ArrayBufferView
      | string
      | null
      | Blob,
    options?: R2PutOptions
  ): Promise<R2Object>;
  async put(
    key: string,
    value:
      | ReadableStream
      | ArrayBuffer
      | ArrayBufferView
      | string
      | null
      | Blob,
    options?: R2PutOptions
  ): Promise<R2Object | null> {
    try {
      if (value === null) {
        throw new Error("Cannot put null value");
      }

      let body: Buffer | Uint8Array | string;

      if (value instanceof ReadableStream) {
        const reader = value.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          chunks.push(chunk);
        }
        body = Buffer.concat(chunks);
      } else if (value instanceof ArrayBuffer) {
        body = new Uint8Array(value);
      } else if (ArrayBuffer.isView(value)) {
        body = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      } else if (typeof value === "string") {
        body = value;
      } else if (value instanceof Blob) {
        body = new Uint8Array(await value.arrayBuffer());
      } else {
        throw new Error("Unsupported value type");
      }

      const httpMetadata = this.extractHttpMetadata(options?.httpMetadata);

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: httpMetadata?.contentType,
        ContentLanguage: httpMetadata?.contentLanguage,
        ContentDisposition: httpMetadata?.contentDisposition,
        ContentEncoding: httpMetadata?.contentEncoding,
        CacheControl: httpMetadata?.cacheControl,
        Expires: httpMetadata?.cacheExpiry,
        Metadata: options?.customMetadata,
        ContentMD5: typeof options?.md5 === "string" ? options.md5 : undefined,
        ChecksumSHA1:
          typeof options?.sha1 === "string" ? options.sha1 : undefined,
        ChecksumSHA256:
          typeof options?.sha256 === "string" ? options.sha256 : undefined,
      });

      const response = await this.s3Client.send(command);

      return this.createR2Object(key, {
        ...response,
        ContentLength:
          body instanceof Uint8Array ? body.length : Buffer.byteLength(body),
      });
    } catch (error) {
      console.error("Error putting object:", error);
      throw error;
    }
  }

  async delete(keys: string | string[]): Promise<void> {
    try {
      const keysArray = Array.isArray(keys) ? keys : [keys];

      if (keysArray.length === 1) {
        const command = new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: keysArray[0],
        });
        await this.s3Client.send(command);
      } else {
        const command = new DeleteObjectsCommand({
          Bucket: this.bucketName,
          Delete: {
            Objects: keysArray.map((key) => ({ Key: key })),
          },
        });
        await this.s3Client.send(command);
      }
    } catch (error) {
      console.error("Error deleting objects:", error);
      throw error;
    }
  }

  async createMultipartUpload(
    key: string,
    options?: R2MultipartOptions
  ): Promise<R2MultipartUpload> {
    const httpMetadata = this.extractHttpMetadata(options?.httpMetadata);

    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: httpMetadata?.contentType,
      ContentLanguage: httpMetadata?.contentLanguage,
      ContentDisposition: httpMetadata?.contentDisposition,
      ContentEncoding: httpMetadata?.contentEncoding,
      CacheControl: httpMetadata?.cacheControl,
      Expires: httpMetadata?.cacheExpiry,
      Metadata: options?.customMetadata,
    });

    const response = await this.s3Client.send(command);
    const uploadId = response.UploadId!;

    return this.createMultipartUploadObject(key, uploadId);
  }

  resumeMultipartUpload(key: string, uploadId: string): R2MultipartUpload {
    return this.createMultipartUploadObject(key, uploadId);
  }

  private createMultipartUploadObject(
    key: string,
    uploadId: string
  ): R2MultipartUpload {
    return {
      key,
      uploadId,
      uploadPart: async (
        partNumber: number,
        value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob
      ) => {
        let body: Buffer | Uint8Array | string;

        if (value instanceof ReadableStream) {
          const reader = value.getReader();
          const chunks: Uint8Array[] = [];
          while (true) {
            const { done, value: chunk } = await reader.read();
            if (done) break;
            chunks.push(chunk);
          }
          body = Buffer.concat(chunks);
        } else if (value instanceof ArrayBuffer) {
          body = new Uint8Array(value);
        } else if (ArrayBuffer.isView(value)) {
          body = new Uint8Array(
            value.buffer,
            value.byteOffset,
            value.byteLength
          );
        } else if (typeof value === "string") {
          body = value;
        } else if (value instanceof Blob) {
          body = new Uint8Array(await value.arrayBuffer());
        } else {
          throw new Error("Unsupported value type");
        }

        const uploadCommand = new UploadPartCommand({
          Bucket: this.bucketName,
          Key: key,
          PartNumber: partNumber,
          UploadId: uploadId,
          Body: body,
        });

        const partResponse = await this.s3Client.send(uploadCommand);

        return {
          partNumber,
          etag: partResponse.ETag || "",
        };
      },
      abort: async () => {
        const abortCommand = new AbortMultipartUploadCommand({
          Bucket: this.bucketName,
          Key: key,
          UploadId: uploadId,
        });
        await this.s3Client.send(abortCommand);
      },
      complete: async (uploadedParts: R2UploadedPart[]) => {
        const completeCommand = new CompleteMultipartUploadCommand({
          Bucket: this.bucketName,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: uploadedParts.map((part) => ({
              PartNumber: part.partNumber,
              ETag: part.etag,
            })),
          },
        });

        const completeResponse = await this.s3Client.send(completeCommand);

        return this.createR2Object(key, completeResponse);
      },
    };
  }

  private createR2Object(key: string, response: any): R2Object {
    const r2Object = {
      key,
      version: response.VersionId || "",
      size: response.ContentLength || 0,
      etag: response.ETag?.replace(/"/g, "") || "",
      httpEtag: response.ETag || "",
      checksums: this.createChecksums(response),
      uploaded: new Date(response.LastModified || Date.now()),
      httpMetadata: {
        contentType: response.ContentType,
        contentLanguage: response.ContentLanguage,
        contentDisposition: response.ContentDisposition,
        contentEncoding: response.ContentEncoding,
        cacheControl: response.CacheControl,
        cacheExpiry: response.Expires,
      },
      customMetadata: response.Metadata || {},
      storageClass: response.StorageClass || "STANDARD",
      writeHttpMetadata: (_headers: Headers) => {
        // This is a no-op in our implementation
      },
    };

    // Add range if present
    if (response.ContentRange) {
      // Parse content range if needed
      r2Object.range = undefined;
    }

    return r2Object as R2Object;
  }

  private createChecksums(response: any): R2Checksums {
    const checksums: R2Checksums = {
      toJSON(): Record<string, string> {
        const result: Record<string, string> = {};
        if (this.md5) result.md5 = this.arrayBufferToHex(this.md5);
        if (this.sha1) result.sha1 = this.arrayBufferToHex(this.sha1);
        if (this.sha256) result.sha256 = this.arrayBufferToHex(this.sha256);
        if (this.sha384) result.sha384 = this.arrayBufferToHex(this.sha384);
        if (this.sha512) result.sha512 = this.arrayBufferToHex(this.sha512);
        return result;
      },
      arrayBufferToHex(buffer: ArrayBuffer): string {
        return Array.from(new Uint8Array(buffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      },
    } as R2Checksums & { arrayBufferToHex(buffer: ArrayBuffer): string };

    // Add checksums if available
    if (response.ChecksumCRC32) {
      // Convert to ArrayBuffer if needed
    }
    if (response.ChecksumSHA1) {
      // Convert to ArrayBuffer if needed
    }
    if (response.ChecksumSHA256) {
      // Convert to ArrayBuffer if needed
    }

    return checksums;
  }

  private formatRange(range: R2Range | Headers): string | undefined {
    if (range instanceof Headers) {
      return range.get("range") || undefined;
    }

    if ("suffix" in range) {
      return `bytes=-${range.suffix}`;
    }

    const { offset = 0, length } = range;
    if (length !== undefined) {
      return `bytes=${offset}-${offset + length - 1}`;
    }
    return `bytes=${offset}-`;
  }

  private extractHttpMetadata(
    metadata?: R2HTTPMetadata | Headers
  ): R2HTTPMetadata | undefined {
    if (!metadata) return undefined;

    if (metadata instanceof Headers) {
      return {
        contentType: metadata.get("content-type") || undefined,
        contentLanguage: metadata.get("content-language") || undefined,
        contentDisposition: metadata.get("content-disposition") || undefined,
        contentEncoding: metadata.get("content-encoding") || undefined,
        cacheControl: metadata.get("cache-control") || undefined,
        cacheExpiry: metadata.get("expires")
          ? new Date(metadata.get("expires")!)
          : undefined,
      };
    }

    return metadata;
  }
}
