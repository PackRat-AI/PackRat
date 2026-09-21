// Thin Neon API client for the ephemeral dev-environment tooling.
//
// Only the handful of endpoints `bun devenv` needs. Everything is scoped to a
// single project id so a stray call can never touch another Neon project.

const API = 'https://console.neon.tech/api/v2';

export interface NeonBranch {
  id: string;
  name: string;
  parent_id?: string;
  created_at: string;
  current_state: string;
}

export interface NeonEndpoint {
  id: string;
  branch_id: string;
  host: string;
  type: string;
}

export class NeonError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(opts: { message: string; status: number; body: string }) {
    super(opts.message);
    this.name = 'NeonError';
    this.status = opts.status;
    this.body = opts.body;
  }
}

export class NeonClient {
  constructor(
    private readonly apiKey: string,
    private readonly projectId: string,
  ) {}

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...init?.headers,
      },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new NeonError({
        message: `Neon ${init?.method ?? 'GET'} ${path} → ${res.status}`,
        status: res.status,
        body: text,
      });
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  async listBranches(): Promise<NeonBranch[]> {
    const { branches } = await this.call<{ branches: NeonBranch[] }>(
      `/projects/${this.projectId}/branches`,
    );
    return branches;
  }

  async findBranchByName(name: string): Promise<NeonBranch | undefined> {
    return (await this.listBranches()).find((b) => b.name === name);
  }

  /**
   * Create a copy-on-write branch off `parentId` with a read-write endpoint.
   * Neon returns the endpoint and connection URIs in the same response.
   */
  async createBranch(opts: {
    name: string;
    parentId: string;
  }): Promise<{ branch: NeonBranch; connectionUris: { connection_uri: string }[] }> {
    return this.call(`/projects/${this.projectId}/branches`, {
      method: 'POST',
      body: JSON.stringify({
        branch: { name: opts.name, parent_id: opts.parentId },
        endpoints: [{ type: 'read_write' }],
      }),
    });
  }

  async deleteBranch(branchId: string): Promise<void> {
    await this.call(`/projects/${this.projectId}/branches/${branchId}`, { method: 'DELETE' });
  }

  /**
   * Pooled connection string for a branch. Neon's pooler host is the endpoint
   * host with `-pooler` inserted before the first dot — the API does not return
   * it directly, so it is derived here (documented Neon convention).
   */
  static toPooled(uri: string): string {
    const url = new URL(uri);
    if (!url.hostname.includes('-pooler.')) {
      url.hostname = url.hostname.replace('.', '-pooler.');
    }
    return url.toString();
  }
}
