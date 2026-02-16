import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { createMockR2 } from "./mock-r2";

const authHeaders = {
  "x-agent": "test-agent",
  "x-api-key": "test-key",
};

describe("Debug heartbeat", () => {
  test("debug heartbeat", async () => {
    const bucket = createMockR2();
    const app = createApp(bucket, "test-key");

    // Initialize board
    const initRes = await app.handle(
      new Request("http://localhost/board/init", {
        method: "POST",
        headers: { ...authHeaders, "content-type": "application/json" },
        body: JSON.stringify({ name: "Test", description: "Test" }),
      }),
    );
    console.log("Init status:", initRes.status);
    console.log("Init etag:", initRes.headers.get("etag"));

    const etag = initRes.headers.get("etag");
    console.log("Using etag:", etag);

    // Try heartbeat
    const heartbeatRes = await app.handle(
      new Request("http://localhost/agents/test-agent/heartbeat", {
        method: "POST",
        headers: {
          ...authHeaders,
          "content-type": "application/json",
          "if-match": etag!,
        },
        body: JSON.stringify({ status: "active" }),
      }),
    );
    console.log("Heartbeat status:", heartbeatRes.status);
    const body = await heartbeatRes.text();
    console.log("Heartbeat body:", body);

    expect(heartbeatRes.status).toBe(200);
  });
});
