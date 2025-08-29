import type { ToolUIPart } from 'ai';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import type { PackItem } from 'expo-app/features/packs';
import type { Pack } from 'expo-app/features/packs/types';
import type { CatalogItemsTool } from './CatalogItemsGenerativeUI';
import { CatalogItemsGenerativeUI } from './CatalogItemsGenerativeUI';
import { GuidesRAGGenerativeUI } from './GuidesRAGGenerativeUI';
import { PackDetailsGenerativeUI } from './PackDetailsGenerativeUI';
import { PackItemDetailsGenerativeUI } from './PackItemDetailsGenerativeUI';
import type { WeatherTool } from './WeatherGenerativeUI';
import { WeatherGenerativeUI } from './WeatherGenerativeUI';
import type { WebSearchTool } from './WebSearchGenerativeUI';
import { WebSearchGenerativeUI } from './WebSearchGenerativeUI';

interface GuideSearchResult {
  file_id: string;
  filename: string;
  score: number;
  attributes: {
    timestamp: number;
    folder: string;
    filename: string;
  };
  content: Array<{
    id: string;
    type: string;
    text: string;
  }>;
  url: string;
}

interface GuidesSearchResultsData {
  object: string;
  search_query: string;
  data: GuideSearchResult[];
  has_more: boolean;
  next_page: string | null;
}

interface RAGSearchResult {
  success: boolean;
  results?: GuidesSearchResultsData;
}

interface ToolInvocationRendererProps {
  toolInvocation: ToolUIPart;
}

type Tool = WebSearchTool | WeatherTool | CatalogItemsTool;

export function ToolInvocationRenderer({ toolInvocation }: ToolInvocationRendererProps) {
  const tool = toolInvocation as Tool;

  console.log('tool', JSON.stringify(tool));

  switch (tool.type) {
    case 'tool-webSearchTool':
      return <WebSearchGenerativeUI toolInvocation={tool} />;
    case 'tool-getWeatherForLocation':
      return <WeatherGenerativeUI toolInvocation={tool} />;
    case 'tool-getCatalogItems':
    case 'tool-semanticCatalogSearch':
      return <CatalogItemsGenerativeUI toolInvocation={tool} />;
    default:
      return null;
  }

  // TODO SQL TOOL

  // if (
  //   toolName === 'tool-searchPackratOutdoorGuidesRAG' &&
  //   isQueryArgs(args) &&
  //   isRAGSearchResult(result)
  // ) {
  //   // Handle searchPackratOutdoorGuidesRAG tool result
  //     return <GuidesRAGGenerativeUI searchQuery={args.query} results={result.results} />;
  //   }
  // }

  // if (toolName === 'tool-getPackDetails' && isPackDetailsResult(result)) {
  //   // Handle getPackDetails tool result
  //     return <PackDetailsGenerativeUI pack={result.pack} />;
  //   }
  // }

  // if (toolName === 'tool-getPackItemDetails' && isPackItemDetailsResult(result)) {
  //   // Handle getPackItemDetails tool result
  //     return <PackItemDetailsGenerativeUI item={result.item} />;
  //   }
  // }
}
