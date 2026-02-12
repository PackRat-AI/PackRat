import { loadConfig } from "./config";
import type { Config } from "./config";

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

	async function request<T>(
		path: string,
		options: RequestInit = {},
	): Promise<ApiResponse<T>> {
		const url = `${config.url}${path}`;
		const res = await fetch(url, {
			...options,
			headers: {
				...baseHeaders,
				...(options.headers as Record<string, string>),
			},
		});

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

		getBoard: () => request<any>("/board"),

		getStories: (query?: Record<string, string>) => {
			const params = new URLSearchParams(query);
			const qs = params.toString() ? `?${params}` : "";
			return request<{ userStories: any[]; etag: string }>(`/stories${qs}`);
		},

		getStory: (id: string) => request<any>(`/stories/${id}`),

		createStory: (body: any, etag: string) =>
			request<any>("/stories", {
				method: "POST",
				body: JSON.stringify(body),
				headers: { "if-match": etag },
			}),

		updateStory: (id: string, body: any, etag: string) =>
			request<any>(`/stories/${id}`, {
				method: "PATCH",
				body: JSON.stringify(body),
				headers: { "if-match": etag },
			}),

		getComments: (storyId: string) =>
			request<{ comments: any[]; etag: string | null }>(
				`/stories/${storyId}/comments`,
			),

		createComment: (storyId: string, body: string, etag: string) =>
			request<any>(`/stories/${storyId}/comments`, {
				method: "POST",
				body: JSON.stringify({ body }),
				headers: { "if-match": etag },
			}),

		claimStory: (id: string, etag: string) =>
			request<any>(`/stories/${id}/claim`, {
				method: "POST",
				headers: { "if-match": etag },
			}),

		unclaimStory: (id: string, etag: string) =>
			request<any>(`/stories/${id}/unclaim`, {
				method: "POST",
				headers: { "if-match": etag },
			}),

		initBoard: (body: any) =>
			request<any>("/board/init", {
				method: "POST",
				body: JSON.stringify(body),
			}),

		exportBoard: () => request<any>("/board/export"),
		exportRalph: () => request<any>("/board/export/ralph"),
		getAgents: () => request<{ agents: Record<string, any> }>("/agents"),
	};
}

export type Client = ReturnType<typeof createClient>;
