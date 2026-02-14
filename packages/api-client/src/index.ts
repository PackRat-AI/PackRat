/// <reference path="./cf-types.d.ts" />

import { treaty, type Treaty } from "@elysiajs/eden";
import type { App } from "@swarmboard/api";

export type SwarmboardClient = ReturnType<typeof treaty<App>>;

export function createClient(
	baseUrl: string,
	options?: NonNullable<Parameters<typeof treaty<App>>[1]>,
): SwarmboardClient {
	return treaty<App>(baseUrl, options);
}
