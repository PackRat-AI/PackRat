import type { Agent, Board, Comment, Story } from "@swarmboard/shared";
import type { Config } from "./config";
import { loadConfig } from "./config";

export interface ApiResponse<T> {
	data: T | null;
	error: string | null;
	status: number;
	headers: Headers;
}

/**
 * Lightweight API client that wraps fetch.
 * We use plain fetch instead of Eden Treaty here to avoid
 * bundling Elysia types at runtime. The CLI is published as
 * a standalone binary.
 */
export function createClient(configOverride?: Config) {
	const config = configOverride ?? loadConfig();

	const baseHeaders: Record<string, string> = {
		authorization: `Bearer ${config.key}`,
		"x-agent": config.agent,
		"content-type": "application/json",
	};

	async function request<T>(opts: {
		path: string;
		options?: RequestInit;
	}): Promise<ApiResponse<T>> {
		const { path, options = {} } = opts;
		const url = `${config.url}${path}`;

		let res: Response;
		try {
			res = await fetch(url, {
				...options,
				headers: {
					...baseHeaders,
					...(options.headers as Record<string, string>),
				},
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : "Network request failed";
			return { data: null, error: message, status: 0, headers: new Headers() };
		}

		const text = await res.text();
		let data: T | null = null;
		let error: string | null = null;

		try {
			const json = JSON.parse(text);
			if (res.ok) {
				data = json as T;
			} else {
				error = json.message ?? json.error ?? text;
			}
		} catch {
			if (res.ok) {
				data = text as unknown as T;
			} else {
				error = text;
			}
		}

		return { data, error, status: res.status, headers: res.headers };
	}

	return {
		config,

		getBoard: () => request<Board & { etag: string }>({ path: "/board" }),

		getStories: (query?: Record<string, string>) => {
			const params = new URLSearchParams(query);
			const qs = params.toString() ? `?${params}` : "";
			return request<{ userStories: Story[]; etag: string }>({ path: `/stories${qs}` });
		},

		getStory: (id: string) => request<Story & { etag: string }>({ path: `/stories/${id}` }),

		createStory: (opts: { body: Record<string, unknown>; etag: string }) =>
			request<Story>({
				path: "/stories",
				options: {
					method: "POST",
					body: JSON.stringify(opts.body),
					headers: { "if-match": opts.etag },
				},
			}),

		updateStory: (opts: { id: string; body: Record<string, unknown>; etag: string }) =>
			request<Story & { etag: string }>({
				path: `/stories/${opts.id}`,
				options: {
					method: "PATCH",
					body: JSON.stringify(opts.body),
					headers: { "if-match": opts.etag },
				},
			}),

		getComments: (storyId: string) =>
			request<{ comments: Comment[]; etag: string | null }>({
				path: `/stories/${storyId}/comments`,
			}),

		createComment: (opts: { storyId: string; body: string; etag: string }) =>
			request<Comment & { etag: string }>({
				path: `/stories/${opts.storyId}/comments`,
				options: {
					method: "POST",
					body: JSON.stringify({ body: opts.body }),
					headers: { "if-match": opts.etag },
				},
			}),

		claimStory: (opts: { id: string; etag: string }) =>
			request<Story & { etag: string }>({
				path: `/stories/${opts.id}/claim`,
				options: {
					method: "POST",
					headers: { "if-match": opts.etag },
				},
			}),

		unclaimStory: (opts: { id: string; etag: string }) =>
			request<Story & { etag: string }>({
				path: `/stories/${opts.id}/unclaim`,
				options: {
					method: "POST",
					headers: { "if-match": opts.etag },
				},
			}),

		initBoard: (body: Record<string, unknown>) =>
			request<Board & { etag: string }>({
				path: "/board/init",
				options: {
					method: "POST",
					body: JSON.stringify(body),
				},
			}),

		exportBoard: () => request<Board>({ path: "/board/export" }),
		exportRalph: () => request<Record<string, unknown>>({ path: "/board/export/ralph" }),
		getAgents: () => request<{ agents: Record<string, Agent> }>({ path: "/agents" }),
	};
}

export type Client = ReturnType<typeof createClient>;
