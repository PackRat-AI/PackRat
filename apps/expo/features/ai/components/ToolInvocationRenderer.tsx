import type { ToolUIPart } from 'ai';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import type { PackItem } from 'expo-app/features/packs';
import type { Pack } from 'expo-app/lib/types';
import { CatalogItemsGenerativeUI } from './CatalogItemsGenerativeUI';
import { GuidesRAGGenerativeUI } from './GuidesRAGGenerativeUI';
import { PackDetailsGenerativeUI } from './PackDetailsGenerativeUI';
import { PackItemDetailsGenerativeUI } from './PackItemDetailsGenerativeUI';
import { WeatherGenerativeUI } from './WeatherGenerativeUI';
import { WebSearchGenerativeUI } from './WebSearchGenerativeUI';

interface WeatherData {
  success: boolean;
  location: string;
  temperature: number;
  conditions: string;
  humidity: number;
  windSpeed: number;
}

interface WebSearchData {
  query: string;
  answer: string;
  sources: Array<{
    type: string;
    sourceType: string;
    id: string;
    url: string;
  }>;
  success: boolean;
}

interface GuideSearchResult {
  source: string;
  object: string;
  score: number;
  file: string;
  extract: string;
  meta: {
    section: string;
    page_number: number;
    file_name: string;
    title?: string;
    date?: string;
  };
}

interface GuidesSearchResultsData {
  object: string;
  search_query: string;
  data: GuideSearchResult[];
  has_more: boolean;
  next_page: string | null;
}

interface CatalogSearchResult {
  success: boolean;
  data?: {
    items: CatalogItem[];
    total: number;
    limit: number;
  };
}

interface PackDetailsResult {
  success: boolean;
  pack?: Pack;
}

interface PackItemDetailsResult {
  success: boolean;
  item?: PackItem;
}

interface RAGSearchResult {
  success: boolean;
  results?: GuidesSearchResultsData;
}

interface ToolInvocationRendererProps {
  toolInvocation: ToolUIPart;
}

export function ToolInvocationRenderer({ toolInvocation }: ToolInvocationRendererProps) {
  // Only render completed tool calls with results
  if (toolInvocation.state !== 'output-available' || !toolInvocation.output) {
    return null;
  }

  const { type: toolName, input: args, output: result } = toolInvocation;

  // Handle getWeatherForLocation tool result
  if (toolName === 'tool-getWeatherForLocation' && isWeatherArgs(args) && isWeatherData(result)) {
    return <WeatherGenerativeUI location={args.location} weatherData={result} />;
  }

  // Handle getCatalogItems tool result
  if (
    (toolName === 'tool-getCatalogItems' || toolName === 'tool-semanticCatalogSearch') &&
    isCatalogSearchResult(result)
  ) {
    if (result.success && result.data) {
      return (
        <CatalogItemsGenerativeUI
          items={result.data.items}
          total={result.data.total}
          limit={result.data.limit}
        />
      );
    }
  }

  // Handle searchPackratOutdoorGuidesRAG tool result
  if (
    toolName === 'tool-searchPackratOutdoorGuidesRAG' &&
    isQueryArgs(args) &&
    isRAGSearchResult(result)
  ) {
    if (result.success && result.results) {
      return <GuidesRAGGenerativeUI searchQuery={args.query} results={result.results} />;
    }
  }

  // Handle getPackDetails tool result
  if (toolName === 'tool-getPackDetails' && isPackDetailsResult(result)) {
    if (result.success && result.pack) {
      return <PackDetailsGenerativeUI pack={result.pack} />;
    }
  }

  // Handle getPackItemDetails tool result
  if (toolName === 'tool-getPackItemDetails' && isPackItemDetailsResult(result)) {
    if (result.success && result.item) {
      return <PackItemDetailsGenerativeUI item={result.item} />;
    }
  }

  if (toolName === 'tool-webSearchTool' && isQueryArgs(args) && isWebSearchData(result)) {
    if (result.success) {
      return <WebSearchGenerativeUI searchQuery={args.query} searchData={result} />;
    }
  }

  return null;
}

// Type guard functions
function isWeatherArgs(args: unknown): args is { location: string } {
  return (
    typeof args === 'object' &&
    args !== null &&
    'location' in args &&
    typeof (args as { location: unknown }).location === 'string'
  );
}

function isWeatherData(result: unknown): result is WeatherData {
  return (
    typeof result === 'object' &&
    result !== null &&
    'success' in result &&
    'location' in result &&
    'temperature' in result &&
    'conditions' in result &&
    'humidity' in result &&
    'windSpeed' in result
  );
}

function isQueryArgs(args: unknown): args is { query: string } {
  return (
    typeof args === 'object' &&
    args !== null &&
    'query' in args &&
    typeof (args as { query: unknown }).query === 'string'
  );
}

function isCatalogSearchResult(result: unknown): result is CatalogSearchResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'success' in result &&
    typeof (result as { success: unknown }).success === 'boolean'
  );
}

function isRAGSearchResult(result: unknown): result is RAGSearchResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'success' in result &&
    typeof (result as { success: unknown }).success === 'boolean'
  );
}

function isPackDetailsResult(result: unknown): result is PackDetailsResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'success' in result &&
    typeof (result as { success: unknown }).success === 'boolean'
  );
}

function isPackItemDetailsResult(result: unknown): result is PackItemDetailsResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    'success' in result &&
    typeof (result as { success: unknown }).success === 'boolean'
  );
}

function isWebSearchData(result: unknown): result is WebSearchData {
  return (
    typeof result === 'object' &&
    result !== null &&
    'success' in result &&
    'query' in result &&
    'answer' in result &&
    'sources' in result
  );
}
