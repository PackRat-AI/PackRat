import type { AutoRAG } from '@cloudflare/workers-types';
import type { Env } from '@packrat/api/types/env';
import type { Context } from 'hono';
import { env } from 'hono/adapter';

export class AIService {
  private env: Env;
  private guidesRAG: AutoRAG;

  constructor(c: Context) {
    this.env = env<Env>(c);
    this.guidesRAG = this.env.AI.autorag(this.env.PACKRAT_GUIDES_RAG_NAME);
  }

  async searchPackratOutdoorGuidesRAG(
    query: string,
    limit: number = 5,
  ): Promise<
    Omit<AutoRagSearchResponse, 'data'> & {
      data: (AutoRagSearchResponse['data'][0] & { url: string })[];
    }
  > {
    const response = await this.guidesRAG.search({
      query,
      max_num_results: limit,
      ranking_options: {
        score_threshold: 0.3,
      },
    });

    const data = response.data.map((item) => ({
      ...item,
      url: this.filenameToUrl(item.filename),
    }));

    return {
      ...response,
      data,
    };
  }
  /**
   * Maps filename in response to URL e.g budget-friendly-family-camping-packing-smart-for-a-memorable-trip.mdx maps to https://guides.packratai.com/guide/budget-friendly-family-camping-packing-smart-for-a-memorable-trip
   * @param filename
   * @returns
   */
  private filenameToUrl(filename: string): string {
    const slug = filename.replace(/\.mdx$/, '').trim();
    const baseUrl = this.env.PACKRAT_GUIDES_BASE_URL;
    return new URL(`guide/${slug}`, baseUrl).toString();
  }
}
