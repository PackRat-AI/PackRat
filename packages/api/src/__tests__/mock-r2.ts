/**
 * In-memory R2Bucket mock for testing.
 * Implements the subset of R2Bucket API used by our storage layer.
 */
export function createMockR2(): R2Bucket {
	const store = new Map<string, { body: string; etag: string }>();
	let etagCounter = 0;

	function nextEtag(): string {
		etagCounter++;
		return `"etag-${etagCounter}"`;
	}

	return {
		get: async (key: string) => {
			const entry = store.get(key);
			if (!entry) return null;
			return {
				json: async () => JSON.parse(entry.body),
				text: async () => entry.body,
				httpEtag: entry.etag,
				key,
			} as unknown as R2ObjectBody;
		},

		put: async (
			key: string,
			value: string | ReadableStream | ArrayBuffer | Blob,
			options?: R2PutOptions,
		) => {
			const body = typeof value === "string" ? value : await new Response(value).text();

			// Check conditional write (onlyIf.etagMatches)
			if (options?.onlyIf) {
				const condition = options.onlyIf as { etagMatches?: string };
				if (condition.etagMatches) {
					const existing = store.get(key);
					if (!existing || existing.etag !== condition.etagMatches) {
						return null as unknown as R2Object;
					}
				}
			}

			const etag = nextEtag();
			store.set(key, { body, etag });
			return { httpEtag: etag, key } as unknown as R2Object;
		},

		head: async (key: string) => {
			const entry = store.get(key);
			if (!entry) return null;
			return { httpEtag: entry.etag, key } as unknown as R2Object;
		},

		delete: async (key: string | string[]) => {
			if (Array.isArray(key)) {
				for (const k of key) store.delete(k);
			} else {
				store.delete(key);
			}
		},

		list: async () => {
			return {
				objects: [...store.keys()].map((k) => ({
					key: k,
					httpEtag: store.get(k)?.etag ?? "",
				})),
				truncated: false,
			} as unknown as R2Objects;
		},

		createMultipartUpload: async () => {
			throw new Error("Not implemented in mock");
		},
		resumeMultipartUpload: () => {
			throw new Error("Not implemented in mock");
		},
	} as unknown as R2Bucket;
}
