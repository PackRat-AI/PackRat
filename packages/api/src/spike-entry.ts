/**
 * U1 spike — standalone Worker entry. THROWAWAY.
 *
 * This file is the `main` for `wrangler.spike.jsonc`. It exports the
 * SpikeEtlWorkflow class so the Cloudflare runtime can host it, plus a tiny
 * fetch handler that triggers a new instance on demand for convenience.
 *
 * Delete this file (and the workflow file, and wrangler.spike.jsonc) after
 * the GO/NO-GO decision lands U3's production CatalogEtlWorkflow.
 */

import { SpikeEtlWorkflow, type SpikeEtlWorkflowParams } from './workflows/spike-etl-workflow';

export { SpikeEtlWorkflow };

type SpikeEnv = {
  PACKRAT_SCRAPY_BUCKET: R2Bucket;
  SPIKE_ETL_WORKFLOW: Workflow<SpikeEtlWorkflowParams>;
};

export default {
  async fetch(request: Request, env: SpikeEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/trigger') {
      return new Response(
        'POST /trigger with JSON body { objectKey, source } to start a spike workflow.\n',
        { status: 200, headers: { 'Content-Type': 'text/plain' } },
      );
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const params = (await request.json()) as SpikeEtlWorkflowParams;
    const instance = await env.SPIKE_ETL_WORKFLOW.create({ params });
    const status = await instance.status();

    return new Response(JSON.stringify({ instanceId: instance.id, status }, null, 2), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
