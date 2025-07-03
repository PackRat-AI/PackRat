import type { PackCategory } from "expo-app/types";
import { atom } from "jotai";

export const activeFilterAtom = atom<PackCategory | "all">("all");
export const searchValueAtom = atom<string>("");
