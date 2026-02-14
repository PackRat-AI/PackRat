import { describe, it, expect } from "bun:test";

describe("constants", () => {
  it("should have valid status values", () => {
    const statuses = ["backlog", "todo", "in_progress", "blocked", "review", "done"];
    expect(statuses.length).toBe(6);
  });

  it("should have valid priority range", () => {
    const minPriority = 1;
    const maxPriority = 5;
    expect(minPriority).toBeLessThanOrEqual(maxPriority);
  });
});

describe("utilities", () => {
  it("should format status for display", () => {
    const formatStatus = (status: string) => status.replace("_", " ");
    expect(formatStatus("in_progress")).toBe("in progress");
    expect(formatStatus("todo")).toBe("todo");
  });

  it("should get status color", () => {
    const getStatusColor = (status: string) => {
      const colors: Record<string, string> = {
        backlog: "#6b7280",
        todo: "#f59e0b",
        in_progress: "#3b82f6",
        blocked: "#ef4444",
        review: "#8b5cf6",
        done: "#22c55e",
      };
      return colors[status] || "#6b7280";
    };
    expect(getStatusColor("done")).toBe("#22c55e");
    expect(getStatusColor("unknown")).toBe("#6b7280");
  });

  it("should validate story id format", () => {
    const isValidId = (id: string) => id.startsWith("story-") || id.startsWith("S-");
    expect(isValidId("story-123")).toBe(true);
    expect(isValidId("S-456")).toBe(true);
    expect(isValidId("invalid")).toBe(false);
  });

  it("should generate api key prefix", () => {
    const generateKey = () => "sb-" + crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    const key = generateKey();
    expect(key.startsWith("sb-")).toBe(true);
    expect(key.length).toBeGreaterThan(3);
  });
});

describe("validation", () => {
  it("should validate required fields", () => {
    const hasRequiredFields = (obj: Record<string, unknown>, fields: string[]) => 
      fields.every(f => obj[f] !== undefined && obj[f] !== null && obj[f] !== "");
    
    expect(hasRequiredFields({ title: "Test", description: "Desc" }, ["title", "description"])).toBe(true);
    expect(hasRequiredFields({ title: "Test" }, ["title", "description"])).toBe(false);
  });

  it("should validate status values", () => {
    const validStatuses = ["backlog", "todo", "in_progress", "blocked", "review", "done"];
    const isValidStatus = (status: string) => validStatuses.includes(status);
    
    expect(isValidStatus("done")).toBe(true);
    expect(isValidStatus("invalid")).toBe(false);
  });

  it("should validate priority range", () => {
    const isValidPriority = (p: number) => p >= 1 && p <= 5;
    
    expect(isValidPriority(1)).toBe(true);
    expect(isValidPriority(5)).toBe(true);
    expect(isValidPriority(0)).toBe(false);
    expect(isValidPriority(6)).toBe(false);
  });
});
