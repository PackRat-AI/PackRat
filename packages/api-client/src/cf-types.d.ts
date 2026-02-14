// Stubs for Cloudflare Workers types that the API package references.
// These allow consumers (web, CLI) to resolve the App type without
// pulling in @cloudflare/workers-types.

interface Fetcher {
	fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
}

declare class R2Bucket {
	head(key: string): Promise<R2Object | null>;
	get(key: string): Promise<R2ObjectBody | null>;
	put(key: string, value: ReadableStream | ArrayBuffer | string | null | Blob, options?: R2PutOptions): Promise<R2Object>;
	delete(keys: string | string[]): Promise<void>;
	list(options?: R2ListOptions): Promise<R2Objects>;
}

interface R2Object {
	key: string;
	version: string;
	size: number;
	etag: string;
	httpEtag: string;
	checksums: R2Checksums;
	uploaded: Date;
	httpMetadata?: R2HTTPMetadata;
	customMetadata?: Record<string, string>;
}

interface R2ObjectBody extends R2Object {
	body: ReadableStream;
	bodyUsed: boolean;
	arrayBuffer(): Promise<ArrayBuffer>;
	text(): Promise<string>;
	json<T>(): Promise<T>;
	blob(): Promise<Blob>;
}

interface R2PutOptions {
	httpMetadata?: R2HTTPMetadata;
	customMetadata?: Record<string, string>;
	md5?: string;
	sha1?: string;
	sha256?: string;
	sha384?: string;
	sha512?: string;
	onlyIf?: R2Conditional;
}

interface R2ListOptions {
	limit?: number;
	prefix?: string;
	cursor?: string;
	delimiter?: string;
	include?: ("httpMetadata" | "customMetadata")[];
}

interface R2Objects {
	objects: R2Object[];
	truncated: boolean;
	cursor?: string;
	delimitedPrefixes: string[];
}

interface R2Checksums {
	md5?: ArrayBuffer;
	sha1?: ArrayBuffer;
	sha256?: ArrayBuffer;
	sha384?: ArrayBuffer;
	sha512?: ArrayBuffer;
}

interface R2HTTPMetadata {
	contentType?: string;
	contentLanguage?: string;
	contentDisposition?: string;
	contentEncoding?: string;
	cacheControl?: string;
	cacheExpiry?: Date;
}

interface R2Conditional {
	etagMatches?: string;
	etagDoesNotMatch?: string;
	uploadedBefore?: Date;
	uploadedAfter?: Date;
}
