import type { Board } from "../../entities/story/model";

const API_BASE =
  import.meta.env?.BUN_PUBLIC_API_URL ?? `${window.location.origin}/api`;

export async function fetchBoard(): Promise<Board> {
  const res = await fetch(`${API_BASE}/board`, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function claimStory(id: string) {
  const res = await fetch(`${API_BASE}/stories/${id}/claim`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function updateStory(id: string, status: string) {
  const res = await fetch(`${API_BASE}/stories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await res.text());
}
