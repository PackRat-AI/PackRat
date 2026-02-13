/**
 * @swarmboard/mcp-server - Client
 *
 * HTTP client for interacting with swarmboard API
 * Uses X-API-Key header for simple API key authentication
 */

export interface Story {
	id: string;
	title: string;
	description?: string;
	status: "TODO" | "IN_PROGRESS" | "DONE";
	assignee?: string;
	createdAt: string;
	updatedAt: string;
}

export interface Comment {
	id: string;
	storyId: string;
	message: string;
	author: string;
	createdAt: string;
}

export interface Agent {
	id: string;
	name: string;
	role: string;
	lastSeen: string;
}

export interface Board {
	stories: Story[];
	agents: Agent[];
}

export interface ClientConfig {
	/** Base URL of the swarmboard API */
	baseUrl: string;
	/** API key for authentication */
	apiKey: string;
	/** Agent ID to identify this client */
	agentId: string;
}

export class SwarmboardClient {
	private baseUrl: string;
	private apiKey: string;
	private agentId: string;

	constructor(config: string | ClientConfig);
	constructor(config: ClientConfig) {
		if (typeof config === "string") {
			// Backward compatibility: treat as baseUrl
			this.baseUrl = config;
			this.apiKey = process.env.SWARMBOARD_API_KEY || "";
			this.agentId = process.env.SWARMBOARD_AGENT_ID || "mcp-agent";
		} else {
			this.baseUrl = config.baseUrl;
			this.apiKey = config.apiKey || process.env.SWARMBOARD_API_KEY || "";
			this.agentId = config.agentId || process.env.SWARMBOARD_AGENT_ID || "mcp-agent";
		}
	}

	private getHeaders(mutating = false): Record<string, string> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			"X-API-Key": this.apiKey,
		};

		// Require X-Agent on mutating requests
		if (mutating) {
			headers["X-Agent"] = this.agentId;
		}

		return headers;
	}

	private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
		const response = await fetch(`${this.baseUrl}${endpoint}`, {
			...options,
			headers: {
				...this.getHeaders(
					options.method === "POST" ||
						options.method === "PATCH" ||
						options.method === "PUT" ||
						options.method === "DELETE",
				),
				...options.headers,
			},
		});

		if (!response.ok) {
			const errorBody = await response.text();
			throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorBody}`);
		}

		// Handle empty responses
		const text = await response.text();
		if (!text) return {} as T;

		return JSON.parse(text) as Promise<T>;
	}

	// Stories
	async getStories(status?: string, assignee?: string): Promise<Story[]> {
		const params = new URLSearchParams();
		if (status) params.append("status", status);
		if (assignee) params.append("assignee", assignee);

		const query = params.toString();
		const endpoint = `/stories${query ? `?${query}` : ""}`;

		const result = await this.request<{ stories: Story[] }>(endpoint);
		return result.stories;
	}

	async getStory(id: string): Promise<Story & { comments: Comment[] }> {
		return this.request<Story & { comments: Comment[] }>(`/stories/${id}`);
	}

	async addStory(title: string, description?: string): Promise<Story> {
		const result = await this.request<{ story: Story }>("/stories", {
			method: "POST",
			body: JSON.stringify({ title, description }),
		});
		return result.story;
	}

	async updateStoryStatus(id: string, status: "TODO" | "IN_PROGRESS" | "DONE"): Promise<Story> {
		const result = await this.request<{ story: Story }>(`/stories/${id}`, {
			method: "PATCH",
			body: JSON.stringify({ status }),
		});
		return result.story;
	}

	// Claims
	async claimStory(id: string): Promise<Story> {
		const result = await this.request<{ story: Story }>(`/stories/${id}/claim`, { method: "POST" });
		return result.story;
	}

	async unclaimStory(id: string): Promise<Story> {
		const result = await this.request<{ story: Story }>(`/stories/${id}/unclaim`, {
			method: "POST",
		});
		return result.story;
	}

	// Comments
	async addComment(storyId: string, message: string): Promise<Comment> {
		const result = await this.request<{ comment: Comment }>(`/stories/${storyId}/comments`, {
			method: "POST",
			body: JSON.stringify({ message }),
		});
		return result.comment;
	}

	async getComments(storyId: string): Promise<Comment[]> {
		const result = await this.request<{ comments: Comment[] }>(`/stories/${storyId}/comments`);
		return result.comments;
	}

	// Agents
	async getAgents(): Promise<Agent[]> {
		const result = await this.request<{ agents: Agent[] }>("/agents");
		return result.agents;
	}

	async registerAgent(name: string, role: string): Promise<Agent> {
		const result = await this.request<{ agent: Agent }>("/agents", {
			method: "POST",
			body: JSON.stringify({ name, role }),
		});
		return result.agent;
	}

	// Board
	async initBoard(): Promise<void> {
		await this.request("/board/init", { method: "POST" });
	}

	async getBoard(): Promise<Board> {
		return this.request<Board>("/board");
	}

	async exportBoard(): Promise<string> {
		const result = await this.request<{ export: string }>("/board/export");
		return result.export;
	}

	/** Set the agent ID for this client */
	setAgentId(agentId: string): void {
		this.agentId = agentId;
	}

	/** Get the current agent ID */
	getAgentId(): string {
		return this.agentId;
	}
}
