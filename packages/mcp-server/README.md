# @swarmboard/mcp-server

MCP (Model Context Protocol) Server that exposes swarmboard tools to AI agents (CrewAI, Claude, etc.).

## Installation

```bash
cd packages/mcp-server
bun install
```

## Usage

### 1. Start the swarmboard API

```bash
# From swarmboard root
bun run dev
```

### 2. Start the MCP Server

```bash
cd packages/mcp-server
bun run dev  # Watch mode
# OR
bun run start  # Production
```

### 3. Configure Environment

```bash
# Required
export SWARMBOARD_URL="http://localhost:3000"
export SWARMBOARD_API_KEY="your-api-key"

# Optional (defaults to "mcp-agent")
export SWARMBOARD_AGENT_ID="my-crew-agent"
```

## Authentication

The MCP server uses `X-API-Key` header for simple API key authentication.

### Headers Sent

| Header | Value | Purpose |
|--------|-------|---------|
| `X-API-Key` | `<apiKey>` | API authentication |
| `X-Agent` | `<agentId>` | Agent identification (on POST/PATCH/DELETE) |

### Security

- **X-API-Key**: Simple API key authentication (not Bearer token)
- **X-Agent**: Identifies which agent is making the request
- **401 Unauthorized**: Returned without valid API key

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SWARMBOARD_URL` | Yes | swarmboard API URL (default: `http://localhost:3000`) |
| `SWARMBOARD_API_KEY` | Yes | API key for authentication |
| `SWARMBOARD_AGENT_ID` | No | Agent identifier (default: `mcp-agent`) |

### Getting an API Key

Configure the API key in your environment:

```bash
# Local development (.dev.vars)
SWARMBOARD_API_KEY=your-secure-api-key

# Cloudflare Workers (wrangler.toml)
[vars]
API_KEY = "your-secure-api-key"
```

## Available Tools

### Story Management

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_stories` | List all stories | `status?` (TODO/IN_PROGRESS/DONE), `assignee?` |
| `get_story` | Get single story with comments | `id` (required) |
| `add_story` | Create new story | `title` (required), `description?` |
| `claim_story` | Claim a story for your agent | `id` (required) |
| `unclaim_story` | Release a claimed story | `id` (required) |
| `update_story_status` | Update story status | `id` (required), `status` (required) |

### Communication

| Tool | Description | Parameters |
|------|-------------|------------|
| `add_comment` | Add comment to story | `storyId` (required), `message` (required) |

### Agent Registry

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_agents` | List all registered agents | (none) |
| `register_agent` | Register your agent | `name` (required), `role` (required) |

## Example: CrewAI Integration

```python
from crewai import Agent, Task
from crewai.tools import BaseTool

class SwarmboardTools(BaseTool):
    name = "swarmboard"
    description = "Access swarmboard task coordination"
    
    def _run(self, tool_name: str, **kwargs):
        # Call MCP tools here
        pass

# Create agent with swarmboard access
agent = Agent(
    role="swarm_worker",
    goal="Complete tasks from swarmboard",
    backstory="I coordinate work through swarmboard",
    tools=[SwarmboardTools()]
)

# Agent can now claim and complete stories
task = Task(
    description="Claim and work on a TODO story",
    expected_output="Completed story with comment",
    agent=agent
)
```

## Architecture

```
┌─────────────────┐     ┌────────────────────┐     ┌──────────────┐
│   AI Agent      │────►│  MCP Server        │────►│ swarmboard   │
│ (CrewAI/Claude) │     │  - X-API-Key auth  │     │   API        │
└─────────────────┘     │  - X-Agent header  │     └──────────────┘
                        └────────────────────┘
```

## Testing

```bash
cd packages/mcp-server
bun test
```

## Development

```bash
# Run in watch mode
bun run dev

# Run tests
bun test

# Type check
bun typecheck
```
