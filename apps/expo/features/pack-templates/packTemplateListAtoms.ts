import type { PackCategory } from "expo-app/types";
import { atom } from "jotai";

export const activeTemplateFilterAtom = atom<PackCategory | "all">("all");
export const templateSearchValueAtom = atom<string>("");
