import type { ToolUIPart } from 'ai';
import { CatalogItemsGenerativeUI } from './CatalogItemsGenerativeUI';
import { GuidesRAGGenerativeUI } from './GuidesRAGGenerativeUI';
import { PackDetailsGenerativeUI } from './PackDetailsGenerativeUI';
import { PackItemDetailsGenerativeUI } from './PackItemDetailsGenerativeUI';
import { WeatherGenerativeUI } from './WeatherGenerativeUI';
import { WebSearchGenerativeUI } from './WebSearchGenerativeUI';

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
  if (toolName === 'tool-getWeatherForLocation') {
    return <WeatherGenerativeUI location={args.location} weatherData={result} />;
  }

  // Handle getCatalogItems tool result
  if (
    (toolName === 'tool-getCatalogItems' || toolName === 'tool-semanticCatalogSearch') &&
    result.success &&
    result.data
  ) {
    return (
      <CatalogItemsGenerativeUI
        items={result.data.items}
        total={result.data.total}
        limit={result.data.limit}
      />
    );
  }

  // Handle searchPackratOutdoorGuidesRAG tool result
  if (toolName === 'tool-searchPackratOutdoorGuidesRAG' && result.success && result.results) {
    return <GuidesRAGGenerativeUI searchQuery={args.query} results={result.results} />;
  }

  // Handle getPackDetails tool result
  if (toolName === 'tool-getPackDetails' && result.success && result.pack) {
    return <PackDetailsGenerativeUI pack={result.pack} />;
  }

  // Handle getPackItemDetails tool result
  if (toolName === 'tool-getPackItemDetails' && result.success && result.item) {
    return <PackItemDetailsGenerativeUI item={result.item} />;
  }

  if (toolName === 'tool-webSearchTool' && result.success) {
    return <WebSearchGenerativeUI searchQuery={args.query} searchData={result} />;
  }

  return null;
}
