# Catalog Search Tool for Guides

The Catalog Search Tool provides a specialized interface for the guides generator to search the catalog and retrieve item links. This tool is designed to enhance guide content by automatically finding and including relevant product recommendations with valid links.

## Features

- **Keyword-based catalog search**: Search for items using gear-related keywords
- **Semantic search**: Uses AI embeddings for better search relevance
- **Automatic gear term extraction**: Identifies potential gear mentions in text
- **Link formatting**: Generates markdown links for catalog items
- **Category filtering**: Filter results by gear categories
- **Rating filtering**: Only include highly-rated items
- **Batch processing**: Search multiple terms at once
- **Recommendation formatting**: Generate formatted lists of recommended items

## Usage

### Basic Search

```typescript
import { GuideCatalogSearchTool } from '@packrat/api/utils/guideCatalogSearch';

const searchTool = new GuideCatalogSearchTool(env);

// Search for backpacks
const result = await searchTool.searchCatalogForGuides('backpack', {
  limit: 5,
  minRating: 4.0,
  category: 'packs'
});

console.log(`Found ${result.total} backpacks`);
result.items.forEach(item => {
  console.log(`${item.name} - ${item.productUrl}`);
});
```

### Extract Gear Terms from Content

```typescript
const content = `
  For your backpacking trip, you'll need:
  - A lightweight tent
  - A warm sleeping bag
  - A reliable headlamp
`;

const terms = searchTool.extractGearTerms(content);
console.log(terms); // ['tent', 'sleeping bag', 'headlamp']
```

### Batch Search

```typescript
const results = await searchTool.batchSearchCatalogForGuides(
  ['tent', 'sleeping bag', 'backpack'],
  { limit: 3, minRating: 4.0 }
);

// Process results for each search term
for (const [term, result] of Object.entries(results)) {
  console.log(`${term}: ${result.total} items found`);
}
```

### Generate Recommendations List

```typescript
const items = [...]; // Array of catalog items
const markdown = searchTool.formatRecommendationsList(items, 'Essential Gear');
console.log(markdown);
```

Output:
```markdown
## Essential Gear

- [Awesome Tent](https://example.com/tent) (TestBrand) - $299.99 ⭐ 4.5
- [Great Backpack](https://example.com/backpack) ⭐ 4.2
```

## Integration with Guide Generation

The catalog search tool is integrated into the guide generation process through the enhanced `generateMdxContent` function:

```typescript
// In apps/guides/scripts/generate-content.ts
const content = await generateMdxContent(metadata, existingContent, true); // Enable catalog links
```

When enabled, the guide generator will:

1. Extract potential gear terms from the title and description
2. Add category-specific search terms based on guide categories
3. Search the catalog for relevant items
4. Include product recommendations in the AI prompt
5. Generate content with embedded product links

## AI Tool Integration

A new AI tool `catalogSearchForGuides` is available for the chat system:

```typescript
// Available through the AI tools system
const tools = createTools(context, userId);
await tools.catalogSearchForGuides.execute({
  query: 'sleeping bag',
  category: 'sleep-systems',
  limit: 5,
  minRating: 4.0
});
```

## API

### GuideCatalogSearchTool

#### Constructor

```typescript
new GuideCatalogSearchTool(env: Env)
```

#### Methods

##### searchCatalogForGuides

```typescript
async searchCatalogForGuides(
  query: string,
  options?: {
    limit?: number;        // Default: 10
    category?: string;     // Optional category filter
    minRating?: number;    // Minimum rating (1-5)
  }
): Promise<GuideCatalogSearchResult>
```

##### batchSearchCatalogForGuides

```typescript
async batchSearchCatalogForGuides(
  queries: string[],
  options?: {
    limit?: number;
    category?: string;
    minRating?: number;
  }
): Promise<Record<string, GuideCatalogSearchResult>>
```

##### extractGearTerms

```typescript
extractGearTerms(content: string): string[]
```

##### formatCatalogLink

```typescript
formatCatalogLink(item: CatalogItemLink, linkText?: string): string
```

##### formatRecommendationsList

```typescript
formatRecommendationsList(
  items: CatalogItemLink[], 
  title?: string
): string
```

## Types

### CatalogItemLink

```typescript
interface CatalogItemLink {
  id: number;
  name: string;
  productUrl: string;
  brand?: string | null;
  categories?: string[] | null;
  price?: number | null;
  ratingValue?: number | null;
}
```

### GuideCatalogSearchResult

```typescript
interface GuideCatalogSearchResult {
  items: CatalogItemLink[];
  query: string;
  total: number;
}
```

## Environment Variables

The following environment variables are required:

- `NEON_DATABASE_URL`: Database connection string
- `OPENAI_API_KEY`: OpenAI API key for embeddings
- `AI_PROVIDER`: AI provider (default: 'openai')
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID
- `CLOUDFLARE_AI_GATEWAY_ID`: Cloudflare AI gateway ID

## Testing

Run the test suite:

```bash
cd packages/api
bun test guide-catalog-search.test.ts
```

For integration tests with a real database:

```bash
NEON_DATABASE_URL=your_db_url bun test guide-catalog-search.test.ts
```

## Example Usage

See `examples/guide-catalog-demo.ts` for a complete demonstration of the catalog search functionality.

```bash
bun run examples/guide-catalog-demo.ts
```

## Error Handling

The tool includes comprehensive error handling:

- Returns empty results if search fails
- Logs errors for debugging
- Validates required fields (productUrl)
- Handles missing environment variables gracefully

## Performance Considerations

- Uses semantic search with embeddings for better relevance
- Filters results at the database level when possible
- Batches multiple searches for efficiency
- Limits results to prevent excessive API calls
- Caches extracted terms to avoid duplicate processing

## Future Enhancements

- Support for seasonal gear recommendations
- Integration with user preferences
- A/B testing for recommendation effectiveness
- Analytics for link click-through rates
- Dynamic pricing information
- Inventory availability checks