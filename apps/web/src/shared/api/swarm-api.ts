import type { Board } from "../../entities/story/model";

const API_URL = import.meta.env.VITE_API_URL || "";

function getHeaders(): Record<string, string> {
  const apiKey = localStorage.getItem("swarmboard_api_key");
  return apiKey ? { "X-API-Key": apiKey } : {};
}

export async function fetchBoard(): Promise<Board> {
  const res = await fetch(`${API_URL}/board`, { headers: getHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function claimStory(id: string) {
  const res = await fetch(`${API_URL}/stories/${id}/claim`, { method: "POST", headers: getHeaders() });
  if (!res.ok) throw new Error(await res.text());
}

export async function updateStory(id: string, status: string) {
  const res = await fetch(`${API_URL}/stories/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...getHeaders() }, body: JSON.stringify({ status }) });
  if (!res.ok) throw new Error(await res.text());
}
