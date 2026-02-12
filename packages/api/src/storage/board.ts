import type { Board } from "@swarmboard/shared";
import { BOARD_FILE } from "@swarmboard/shared";

export interface BoardReadResult {
	board: Board;
	etag: string;
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

export async function readBoard(bucket: R2Bucket): Promise<BoardReadResult | null> {
	const obj = await bucket.get(BOARD_FILE);
	if (!obj) return null;

	const board = (await obj.json()) as Board;
	return { board, etag: obj.httpEtag };
}

export async function writeBoard(
	bucket: R2Bucket,
	board: Board,
	expectedEtag: string,
): Promise<WriteResult> {
	const body = JSON.stringify(board, null, 2);

	const obj = await bucket.put(BOARD_FILE, body, {
		httpMetadata: { contentType: "application/json" },
		onlyIf: { etagMatches: expectedEtag },
	});

	if (!obj) {
		return { ok: false, reason: "conflict" };
	}

	return { ok: true, etag: obj.httpEtag };
}

export async function writeBoardUnconditional(
	bucket: R2Bucket,
	board: Board,
): Promise<WriteSuccess> {
	const body = JSON.stringify(board, null, 2);

	const obj = await bucket.put(BOARD_FILE, body, {
		httpMetadata: { contentType: "application/json" },
	});

	// Unconditional write always returns an object
	const etag = obj?.httpEtag ?? "";
	return { ok: true, etag };
}

export async function boardExists(bucket: R2Bucket): Promise<boolean> {
	const head = await bucket.head(BOARD_FILE);
	return head !== null;
}
