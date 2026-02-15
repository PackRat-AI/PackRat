// Shared data access layer for stories.json

import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const STORIES_FILE = join(__dirname, "stories.json");

export interface Story {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  assignee: string | null;
  created_at: string;
  completed_at?: string;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
  last_seen: string;
  created_at: string;
}

export interface Comment {
  id: string;
  storyId: string;
  message: string;
  author: string;
  createdAt: string;
}

export interface DataStore {
  stories: Story[];
  agents: Record<string, Agent>;
  comments: Record<string, Comment[]>;
}

export function readData(): DataStore {
  if (!existsSync(STORIES_FILE)) {
    return { stories: [], agents: {}, comments: {} };
  }
  const data = readFileSync(STORIES_FILE, "utf-8");
  return JSON.parse(data);
}

export function writeData(data: DataStore): void {
  writeFileSync(STORIES_FILE, JSON.stringify(data, null, 2));
}

export function findStoryIndex(stories: Story[], id: string): number {
  return stories.findIndex((s) => s.id === id);
}

export function findStory(stories: Story[], id: string): Story | undefined {
  return stories.find((s) => s.id === id);
}
