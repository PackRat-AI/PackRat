import { isObject } from '@packrat/guards';
import type { OverpassResponse } from './types';

const DEFAULT_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'PackRat/1.0 (+https://packrat.world)';

export interface OverpassClientConfig {
  endpoint?: string;
}

export async function queryOverpass(
  ql: string,
  config?: OverpassClientConfig,
): Promise<OverpassResponse> {
  const endpoint = config?.endpoint ?? DEFAULT_ENDPOINT;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: `data=${encodeURIComponent(ql)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!isObject(data) || !Array.isArray((data as OverpassResponse).elements)) {
    throw new Error('Overpass response is not valid JSON');
  }

  return data as OverpassResponse;
}
