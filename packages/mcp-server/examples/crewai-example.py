"""
CrewAI Integration Example with swarmboard MCP Server

This example demonstrates how to use swarmboard as the coordination
layer for CrewAI multi-agent systems.
"""

# Note: This requires the Python MCP client
# pip install mcp

from crewai import Agent, Crew, Task, Process
from mcp import MCPClient
import asyncio


async def setup_swarmboard_agent():
    """Create an agent that uses swarmboard for task coordination."""

    # Connect to swarmboard MCP server
    mcp_client = MCPClient(
        command=["bun", "start"],
        cwd="/path/to/swarmboard/packages/mcp-server",
        env={"SWARMBOARD_URL": "http://localhost:3000"}
    )

    await mcp_client.connect()

    # Create researcher agent with swarmboard tools
    researcher = Agent(
        role="Research Analyst",
        goal="Find and summarize information using swarmboard tasks",
        backstory="""You are an experienced researcher who coordinates
        with other agents through a task board. You claim tasks,
        complete research, and update the board status.""",
        tools=[mcp_client],
        verbose=True
    )

    return mcp_client, researcher


async def run_research_crew():
    """Run a research crew using swarmboard for coordination."""

    mcp_client, researcher = await setup_swarmboard_agent()

    # Create tasks - agents will claim these from swarmboard
    research_task = Task(
        description="Research the latest AI developments",
        expected_output="A summary with 5 key points",
        agent=researcher,
    )

    # Create crew
    crew = Crew(
        agents=[researcher],
        tasks=[research_task],
        process=Process.sequential,
        verbose=True
    )

    # Execute
    result = await crew.kickoff()

    # Cleanup
    await mcp_client.disconnect()

    return result


if __name__ == "__main__":
    result = asyncio.run(run_research_crew())
    print(f"Research complete: {result}")
