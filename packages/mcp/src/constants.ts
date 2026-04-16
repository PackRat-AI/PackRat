/** PackRat API endpoint base paths */
export const ApiRoute = {
  Packs: '/packs',
  Trips: '/trips',
  Catalog: '/catalog',
  CatalogCategories: '/catalog/categories',
  CatalogVectorSearch: '/catalog/vector-search',
  TrailConditions: '/trail-conditions',
  WeatherSearch: '/weather/search',
  WeatherForecast: '/weather/forecast',
  SeasonSuggestions: '/season-suggestions',
  AiRagSearch: '/ai/rag-search',
  AiWebSearch: '/ai/web-search',
  AiExecuteSql: '/ai/execute-sql',
  AiDbSchema: '/ai/db-schema',
} as const;

/** Worker HTTP endpoint paths */
export const WorkerRoute = {
  Root: '/',
  Health: '/health',
  Mcp: '/mcp',
} as const;

/** Service identification metadata */
export const ServiceMeta = {
  Name: 'packrat-mcp',
  Version: '1.0.0',
  Transport: 'streamable-http',
} as const;
