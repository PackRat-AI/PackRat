import type { User } from "@swarmboard/shared";
import { USERS_FILE } from "@swarmboard/shared";

export interface UsersReadResult {
	users: User[];
	etag: string;
}

export async function readUsers(bucket: R2Bucket): Promise<UsersReadResult | null> {
	const obj = await bucket.get(USERS_FILE);
	if (!obj) return null;

	const users = (await obj.json()) as User[];
	return { users, etag: obj.httpEtag };
}

export async function writeUsers(opts: {
	bucket: R2Bucket;
	users: User[];
	expectedEtag?: string;
}): Promise<{ ok: true; etag: string } | { ok: false; reason: "conflict" }> {
	const body = JSON.stringify(opts.users, null, 2);

	const obj = await opts.bucket.put(USERS_FILE, body, {
		httpMetadata: { contentType: "application/json" },
		onlyIf: opts.expectedEtag ? { etagMatches: opts.expectedEtag } : undefined,
	});

	if (!obj) {
		return { ok: false, reason: "conflict" };
	}

	return { ok: true, etag: obj.httpEtag };
}

export async function usersExist(bucket: R2Bucket): Promise<boolean> {
	const head = await bucket.head(USERS_FILE);
	return head !== null;
}
