// Stub for `cloudflare:workers` — used only in unit-test environments.
// The real module is only available in the Cloudflare Workers runtime.

export const env = {} as Record<string, unknown>;

// Workflows surface — enough for unit tests to import and instantiate.
// Tests provide their own `step` shim and never call `run` via the real
// workflow runtime, so these are intentionally minimal.

export type WorkflowEvent<T> = {
  payload: Readonly<T>;
  timestamp: Date;
  instanceId: string;
};

export type WorkflowStepConfig = {
  retries?: { limit: number; delay: string | number; backoff?: string };
  timeout?: string | number;
};

export interface WorkflowStep {
  do<T>(name: string, callback: () => Promise<T>): Promise<T>;
  do<T>(name: string, config: WorkflowStepConfig, callback: () => Promise<T>): Promise<T>;
  sleep(name: string, duration: string | number): Promise<void>;
  sleepUntil(name: string, timestamp: Date | number): Promise<void>;
}

export abstract class WorkflowEntrypoint<Env = unknown, T = unknown> {
  protected ctx: unknown;
  protected env: Env;
  constructor(ctx: unknown, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }
  abstract run(event: Readonly<WorkflowEvent<T>>, step: WorkflowStep): Promise<unknown>;
}
