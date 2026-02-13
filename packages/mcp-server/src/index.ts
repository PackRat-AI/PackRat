/**
 * @swarmboard/mcp-server
 *
 * MCP Server that exposes swarmboard tools to AI agents (CrewAI, Claude, etc.)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
	type Tool,
} from "@modelcontextprotocol/sdk/types.js";

// Import swarmboard client
import { SwarmboardClient } from "./client.js";

const SWARMBOARD_URL = process.env.SWARMBOARD_URL || "http://localhost:3000";
const SWARMBOARD_API_KEY = process.env.SWARMBOARD_API_KEY || "";
const SWARMBOARD_AGENT_ID = process.env.SWARMBOARD_AGENT_ID || "mcp-agent";

const server = new Server(
	{ name: "swarmboard-mcp-server", version: "0.1.0" },
	{
		capabilities: {
			tools: {},
		},
	},
);

// Create swarmboard client with X-API-Key authentication
const client = new SwarmboardClient({
	baseUrl: SWARMBOARD_URL,
	apiKey: SWARMBOARD_API_KEY,
	agentId: SWARMBOARD_AGENT_ID,
});

// Define tools
const tools: Tool[] = [
	{
		name: "get_stories",
		description: "Get all stories from the swarmboard",
		inputSchema: {
			type: "object",
			properties: {
				status: {
					type: "string",
					enum: ["TODO", "IN_PROGRESS", "DONE"],
					description: "Filter by status (optional)",
				},
				assignee: {
					type: "string",
					description: "Filter by assignee agent ID (optional)",
				},
			},
		},
	},
	{
		name: "get_story",
		description: "Get a single story by ID with comments",
		inputSchema: {
			type: "object",
			properties: {
				id: {
					type: "string",
					description: "The story ID",
				},
			},
			required: ["id"],
		},
	},
	{
		name: "add_story",
		description: "Add a new story to the swarmboard",
		inputSchema: {
			type: "object",
			properties: {
				title: {
					type: "string",
					description: "Story title",
				},
				description: {
					type: "string",
					description: "Story description (optional)",
				},
			},
			required: ["title"],
		},
	},
	{
		name: "claim_story",
		description: "Claim a story for your agent",
		inputSchema: {
			type: "object",
			properties: {
				id: {
					type: "string",
					description: "Story ID to claim",
				},
			},
			required: ["id"],
		},
	},
	{
		name: "unclaim_story",
		description: "Release a claimed story back to TODO",
		inputSchema: {
			type: "object",
			properties: {
				id: {
					type: "string",
					description: "Story ID to unclaim",
				},
			},
			required: ["id"],
		},
	},
	{
		name: "update_story_status",
		description: "Update story status (TODO → IN_PROGRESS → DONE)",
		inputSchema: {
			type: "object",
			properties: {
				id: {
					type: "string",
					description: "Story ID",
				},
				status: {
					type: "string",
					enum: ["TODO", "IN_PROGRESS", "DONE"],
					description: "New status",
				},
			},
			required: ["id", "status"],
		},
	},
	{
		name: "add_comment",
		description: "Add a comment to a story",
		inputSchema: {
			type: "object",
			properties: {
				storyId: {
					type: "string",
					description: "Story ID",
				},
				message: {
					type: "string",
					description: "Comment message",
				},
			},
			required: ["storyId", "message"],
		},
	},
	{
		name: "get_agents",
		description: "Get all registered agents",
		inputSchema: {
			type: "object",
			properties: {},
		},
	},
	{
		name: "register_agent",
		description: "Register your agent with swarmboard",
		inputSchema: {
			type: "object",
			properties: {
				name: {
					type: "string",
					description: "Agent name",
				},
				role: {
					type: "string",
					description: "Agent role (e.g., 'researcher', 'coder', 'reviewer')",
				},
			},
			required: ["name", "role"],
		},
	},
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
	return { tools };
});

// Handle call tool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const { name, arguments: args } = request.params as {
		name: string;
		arguments?: Record<string, unknown>;
	};

	try {
		switch (name) {
			case "get_stories": {
				const result = await client.getStories(
					args?.status as string | undefined,
					args?.assignee as string | undefined,
				);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			}

			case "get_story": {
				const result = await client.getStory(args?.id as string);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			}

			case "add_story": {
				const result = await client.addStory(
					args?.title as string,
					args?.description as string | undefined,
				);
				return {
					content: [
						{
							type: "text",
							text: `Story added: ${JSON.stringify(result, null, 2)}`,
						},
					],
				};
			}

			case "claim_story": {
				const result = await client.claimStory(args?.id as string);
				return {
					content: [
						{
							type: "text",
							text: `Story claimed: ${JSON.stringify(result, null, 2)}`,
						},
					],
				};
			}

			case "unclaim_story": {
				const result = await client.unclaimStory(args?.id as string);
				return {
					content: [
						{
							type: "text",
							text: `Story unclaimed: ${JSON.stringify(result, null, 2)}`,
						},
					],
				};
			}

			case "update_story_status": {
				const result = await client.updateStoryStatus(
					args?.id as string,
					args?.status as "TODO" | "IN_PROGRESS" | "DONE",
				);
				return {
					content: [
						{
							type: "text",
							text: `Story updated: ${JSON.stringify(result, null, 2)}`,
						},
					],
				};
			}

			case "add_comment": {
				const result = await client.addComment(args?.storyId as string, args?.message as string);
				return {
					content: [
						{
							type: "text",
							text: `Comment added: ${JSON.stringify(result, null, 2)}`,
						},
					],
				};
			}

			case "get_agents": {
				const result = await client.getAgents();
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			}

			case "register_agent": {
				const result = await client.registerAgent(args?.name as string, args?.role as string);
				return {
					content: [
						{
							type: "text",
							text: `Agent registered: ${JSON.stringify(result, null, 2)}`,
						},
					],
				};
			}

			default:
				return {
					content: [
						{
							type: "text",
							text: `Unknown tool: ${name}`,
						},
					],
					isError: true,
				};
		}
	} catch (error) {
		return {
			content: [
				{
					type: "text",
					text: `Error calling ${name}: ${error instanceof Error ? error.message : String(error)}`,
				},
			],
			isError: true,
		};
	}
});

// Start server
const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);

console.log("Swarmboard MCP Server running on stdio");
