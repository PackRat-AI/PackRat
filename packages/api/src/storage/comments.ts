import type { Comment } from "@swarmboard/shared";
import { COMMENTS_DIR } from "@swarmboard/shared";

export interface CommentsReadResult {
	comments: Comment[];
	etag: string | null;
}

export interface WriteSuccess {
	ok: true;
	etag: string;
}

export interface WriteConflict {
	ok: false;
	reason: "conflict";
}

export type WriteResult = WriteSuccess | WriteConflict;

function commentKey(storyId: string): string {
	return `${COMMENTS_DIR}/${storyId}.json`;
}

export async function readComments(bucket: R2Bucket, storyId: string): Promise<CommentsReadResult> {
	const obj = await bucket.get(commentKey(storyId));
	if (!obj) {
		return { comments: [], etag: null };
	}

	const comments = (await obj.json()) as Comment[];
	return { comments, etag: obj.httpEtag };
}

export async function writeComments(
	bucket: R2Bucket,
	storyId: string,
	comments: Comment[],
	expectedEtag: string | null,
): Promise<WriteResult> {
	const body = JSON.stringify(comments, null, 2);
	const key = commentKey(storyId);

	if (expectedEtag === null || expectedEtag === "*") {
		// First comment — unconditional write (file doesn't exist yet)
		const obj = await bucket.put(key, body, {
			httpMetadata: { contentType: "application/json" },
		});
		const etag = obj?.httpEtag ?? "";
		return { ok: true, etag };
	}

	const obj = await bucket.put(key, body, {
		httpMetadata: { contentType: "application/json" },
		onlyIf: { etagMatches: expectedEtag },
	});

	if (!obj) {
		return { ok: false, reason: "conflict" };
	}

	return { ok: true, etag: obj.httpEtag };
}
