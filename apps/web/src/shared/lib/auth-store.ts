import { atom } from "jotai";

export const apiKeyAtom = atom<string | null>(
  typeof window !== "undefined"
    ? localStorage.getItem("swarmboard_api_key")
    : null
);

export const agentAtom = atom<string | null>(
  typeof window !== "undefined"
    ? localStorage.getItem("swarmboard_agent")
    : null
);
