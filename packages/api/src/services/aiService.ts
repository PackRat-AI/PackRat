import { createPerplexity } from '@ai-sdk/perplexity';
import type { AutoRAG } from '@cloudflare/workers-types';
import { DEFAULT_MODELS } from '@packrat/api/utils/ai/models';
import type { Env } from '@packrat/api/utils/env-validation';
import { getEnv } from '@packrat/api/utils/env-validation';
import { generateText } from 'ai';
import type { Context } from 'hono';

interface SearchResult {
  answer: string;
  sources: unknown[];
}

const WEB_SEARCH_SYSTEM_PROMPT =
  'You are a helpful research assistant. Provide accurate, up-to-date information with proper citations. Be concise but comprehensive.';

export class AIService {
  private env: Env;
  private guidesRAG: AutoRAG;

  constructor(c: Context) {
    this.env = getEnv(c);
    this.guidesRAG = this.env.AI.autorag(this.env.PACKRAT_GUIDES_RAG_NAME);
  }

  async perplexitySearch(query: string): Promise<SearchResult> {
    const perplexity = createPerplexity({
      apiKey: this.env.PERPLEXITY_API_KEY,
    });

    try {
      const resp = await generateText({
        model: perplexity(DEFAULT_MODELS.PERPLEXITY_SEARCH),
        system: WEB_SEARCH_SYSTEM_PROMPT,
        prompt: query,
      });

      const { text, sources } = resp;
      return { answer: text, sources };
    } catch (error) {
      console.error('Search error:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
