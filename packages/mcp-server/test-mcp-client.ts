/**
 * Integration test script for MCP client against mock API
 * 
 * Usage:
 *   1. Terminal 1: bun run test-mock-server.ts
 *   2. Terminal 2: bun run test-mcp-client.ts
 */

import { SwarmboardClient } from "./src/client.js";

const API_URL = process.env.SWARMBOARD_URL || "http://localhost:3000";
const client = new SwarmboardClient(API_URL);

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log(`\n🦞 Testing MCP Client against ${API_URL}\n`);

  try {
    // Test 1: Get all stories
    console.log("1. Testing getStories()...");
    const stories = await client.getStories();
    console.log(`   ✅ Got ${stories.length} stories`);
    console.log(`   Stories: ${stories.map(s => `${s.id}:${s.status}`).join(", ")}`);

    // Test 2: Get single story
    console.log("\n2. Testing getStory('US-001')...");
    const story = await client.getStory("US-001");
    console.log(`   ✅ Got story: ${story.title} (${story.status})`);

    // Test 3: Add story
    console.log("\n3. Testing addStory()...");
    const newStory = await client.addStory("Test story from MCP client", "Created by integration test");
    console.log(`   ✅ Created: ${newStory.id}: ${newStory.title}`);

    // Test 4: Claim story
    console.log("\n4. Testing claimStory()...");
    const claimed = await client.claimStory(newStory.id);
    console.log(`   ✅ Claimed: ${claimed.id} -> ${claimed.status} (assignee: ${claimed.assignee})`);

    // Test 5: Add comment
    console.log("\n5. Testing addComment()...");
    const comment = await client.addComment(newStory.id, "This is a test comment from MCP client");
    console.log(`   ✅ Comment added: ${comment.id}: "${comment.message}"`);

    // Test 6: Get story with comment
    console.log("\n6. Testing getStory() with new comment...");
    const updatedStory = await client.getStory(newStory.id);
    console.log(`   ✅ Story has ${updatedStory.comments.length} comment(s)`);

    // Test 7: Update status
    console.log("\n7. Testing updateStoryStatus()...");
    const done = await client.updateStoryStatus(newStory.id, "DONE");
    console.log(`   ✅ Updated: ${done.id} -> ${done.status}`);

    // Test 8: Unclaim story
    console.log("\n8. Testing unclaimStory()...");
    const unclaimed = await client.unclaimStory(newStory.id);
    console.log(`   ✅ Unclaimed: ${unclaimed.id} -> ${unclaimed.status} (assignee: ${unclaimed.assignee})`);

    // Test 9: Get agents
    console.log("\n9. Testing getAgents()...");
    const agents = await client.getAgents();
    console.log(`   ✅ Got ${agents.length} agents`);
    console.log(`   Agents: ${agents.map(a => `${a.name}(${a.role})`).join(", ")}`);

    // Test 10: Register agent
    console.log("\n10. Testing registerAgent()...");
    const newAgent = await client.registerAgent("MCP Tester", "integration-tester");
    console.log(`    ✅ Registered: ${newAgent.id}: ${newAgent.name} (${newAgent.role})`);

    // Test 11: Filter stories by status
    console.log("\n11. Testing getStories('DONE')...");
    const doneStories = await client.getStories("DONE");
    console.log(`    ✅ Got ${doneStories.length} DONE stories`);

    // Test 12: Filter stories by assignee
    console.log("\n12. Testing getStories(undefined, 'test-agent')...");
    const assignedStories = await client.getStories(undefined, "test-agent");
    console.log(`    ✅ Got ${assignedStories.length} stories assigned to test-agent`);

    console.log("\n🎉 All integration tests passed!\n");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

runTests();
