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
  // safe-cast: each case branch narrows toolInvocation.type to the discriminant literal; the
  // local tool types (WebSearchTool, etc.) extend ToolUIPart with that exact `type` field, so
  // the cast is verified by the switch guard above each arm.
  switch (toolInvocation.type) {
    case 'tool-webSearchTool':
      // safe-cast: case guard narrows type to discriminant; local tool types extend ToolUIPart with that exact `type` field
      return <WebSearchGenerativeUI toolInvocation={toolInvocation as WebSearchTool} />;
    case 'tool-getWeatherForLocation':
      // safe-cast: case guard narrows type to discriminant literal
      return <WeatherGenerativeUI toolInvocation={toolInvocation as WeatherTool} />;
    case 'tool-getCatalogItems':
    case 'tool-catalogVectorSearch':
      // safe-cast: case guard narrows type to discriminant literal
      return <CatalogItemsGenerativeUI toolInvocation={toolInvocation as CatalogItemsTool} />;
    case 'tool-searchPackratOutdoorGuidesRAG':
      // safe-cast: case guard narrows type to discriminant literal
      return <GuidesRAGGenerativeUI toolInvocation={toolInvocation as GuidesRAGTool} />;
    case 'tool-getPackDetails':
      // safe-cast: case guard narrows type to discriminant literal
      return <PackDetailsGenerativeUI toolInvocation={toolInvocation as PackDetailsTool} />;
    case 'tool-getPackItemDetails':
      // safe-cast: case guard narrows type to discriminant literal
      return <PackItemDetailsGenerativeUI toolInvocation={toolInvocation as PackItemTool} />;
    default:
      return null;
  }

  // TODO SQL TOOL
}
