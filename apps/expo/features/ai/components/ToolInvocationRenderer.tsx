import type { ToolInvocation } from '@ai-sdk/ui-utils';
import { CatalogItemsGenerativeUI } from './CatalogItemsGenerativeUI';
import { GuidesRAGGenerativeUI } from './GuidesRAGGenerativeUI';
import { PackDetailsGenerativeUI } from './PackDetailsGenerativeUI';
import { PackItemDetailsGenerativeUI } from './PackItemDetailsGenerativeUI';
import { WeatherGenerativeUI } from './WeatherGenerativeUI';

interface ToolInvocationRendererProps {
  toolInvocation: ToolInvocation;
}

export function ToolInvocationRenderer({ toolInvocation }: ToolInvocationRendererProps) {
  // Only render completed tool calls with results
  if (toolInvocation.state !== 'result' || !toolInvocation.result) {
    return null;
  }

  const { toolName, args, result } = toolInvocation;

  // Handle getWeatherForLocation tool result
  if (toolName === 'getWeatherForLocation') {
    return <WeatherGenerativeUI location={args.location} weatherData={result} />;
  }

  // Handle getCatalogItems tool result
  if (
    (toolName === 'getCatalogItems' || toolName === 'semanticCatalogSearch') &&
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
  if (toolName === 'searchPackratOutdoorGuidesRAG' && result.success && result.results) {
    return <GuidesRAGGenerativeUI searchQuery={args.query} results={result.results} />;
  }

  // Handle getPackDetails tool result
  if (toolName === 'getPackDetails' && result.success && result.pack) {
    return <PackDetailsGenerativeUI pack={result.pack} />;
  }

  // Handle getPackItemDetails tool result
  if (toolName === 'getPackItemDetails' && result.success && result.item) {
    return <PackItemDetailsGenerativeUI item={result.item} />;
  }

  return null;
}
