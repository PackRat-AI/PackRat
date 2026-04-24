import type { ToolUIPart } from 'ai';
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

export function ToolInvocationRenderer({ toolInvocation }: ToolInvocationRendererProps) {
  switch (toolInvocation.type) {
    case 'tool-webSearchTool':
      return <WebSearchGenerativeUI toolInvocation={toolInvocation as WebSearchTool} />;
    case 'tool-getWeatherForLocation':
      return <WeatherGenerativeUI toolInvocation={toolInvocation as WeatherTool} />;
    case 'tool-getCatalogItems':
    case 'tool-catalogVectorSearch':
      return <CatalogItemsGenerativeUI toolInvocation={toolInvocation as CatalogItemsTool} />;
    case 'tool-searchPackratOutdoorGuidesRAG':
      return <GuidesRAGGenerativeUI toolInvocation={toolInvocation as GuidesRAGTool} />;
    case 'tool-getPackDetails':
      return <PackDetailsGenerativeUI toolInvocation={toolInvocation as PackDetailsTool} />;
    case 'tool-getPackItemDetails':
      return <PackItemDetailsGenerativeUI toolInvocation={toolInvocation as PackItemTool} />;
    default:
      return null;
  }

  // TODO SQL TOOL
}
