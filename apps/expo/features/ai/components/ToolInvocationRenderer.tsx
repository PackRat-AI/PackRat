import type { ToolUIPart } from 'ai';
import { AvailableToolsGenerativeUI } from './AvailableToolsGenerativeUI';
import type { CatalogItemsTool } from './CatalogItemsGenerativeUI';
import { CatalogItemsGenerativeUI } from './CatalogItemsGenerativeUI';
import type { GuidesRAGTool } from './GuidesRAGGenerativeUI';
import { GuidesRAGGenerativeUI } from './GuidesRAGGenerativeUI';
import type { PackDetailsTool } from './PackDetailsGenerativeUI';
import { PackDetailsGenerativeUI } from './PackDetailsGenerativeUI';
import type { PackItemTool } from './PackItemDetailsGenerativeUI';
import { PackItemDetailsGenerativeUI } from './PackItemDetailsGenerativeUI';
import type { WeatherTool } from './WeatherGenerativeUI';
import { WeatherGenerativeUI } from './WeatherGenerativeUI';
import type { WebSearchTool } from './WebSearchGenerativeUI';
import { WebSearchGenerativeUI } from './WebSearchGenerativeUI';

interface ToolInvocationRendererProps {
  toolInvocation: ToolUIPart;
}

type AvailableToolsTool = ToolUIPart & {
  type: 'tool-listAvailableTools';
  output?: {
    tools: Array<{
      name: string;
      displayName: string;
      description: string;
      icon: string;
      category: string;
      example: string;
    }>;
    totalCount: number;
  };
};

type Tool =
  | WebSearchTool
  | WeatherTool
  | CatalogItemsTool
  | GuidesRAGTool
  | PackDetailsTool
  | PackItemTool
  | AvailableToolsTool;

export function ToolInvocationRenderer({ toolInvocation }: ToolInvocationRendererProps) {
  const tool = toolInvocation as Tool;

  switch (tool.type) {
    case 'tool-webSearchTool':
      return <WebSearchGenerativeUI toolInvocation={tool} />;
    case 'tool-getWeatherForLocation':
      return <WeatherGenerativeUI toolInvocation={tool} />;
    case 'tool-getCatalogItems':
    case 'tool-catalogVectorSearch':
      return <CatalogItemsGenerativeUI toolInvocation={tool} />;
    case 'tool-searchPackratOutdoorGuidesRAG':
      return <GuidesRAGGenerativeUI toolInvocation={tool} />;
    case 'tool-getPackDetails':
      return <PackDetailsGenerativeUI toolInvocation={tool} />;
    case 'tool-getPackItemDetails':
      return <PackItemDetailsGenerativeUI toolInvocation={tool} />;
    case 'tool-listAvailableTools': {
      const output = (tool as AvailableToolsTool).output;
      if (output?.tools) {
        return <AvailableToolsGenerativeUI tools={output.tools} totalCount={output.totalCount} />;
      }
      return null;
    }
    default:
      return null;
  }
}
