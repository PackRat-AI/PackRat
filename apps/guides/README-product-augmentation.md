# Product Link Augmentation for Guides

This module automatically enhances outdoor adventure guides by intelligently inserting relevant product recommendations from the PackRat catalog. It uses AI to identify gear mentions in content and matches them with actual products through vector similarity search.

## Features

- **AI-Powered Gear Extraction**: Uses OpenAI GPT-4 to identify outdoor gear mentions in content
- **Vector Search Integration**: Leverages existing catalog vector search for product matching
- **Intelligent Content Augmentation**: Places product recommendations contextually within guides
- **Standalone CLI Tool**: Process existing guides independently
- **API Endpoints**: Integration-ready HTTP endpoints
- **Configurable Parameters**: Adjust similarity thresholds and product limits
- **Backup & Safety**: Automatic backups and dry-run mode for testing

## Quick Start

### 1. Environment Setup

```bash
# Required for AI gear extraction
export OPENAI_API_KEY="your-openai-api-key"

# Optional: Configure AI provider and Cloudflare settings
export AI_PROVIDER="openai"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CLOUDFLARE_AI_GATEWAY_ID="your-gateway-id"

# Database connection for catalog search
export NEON_DATABASE_URL="your-database-url"
```

### 2. Augment Existing Guides

```bash
# Dry run to see what would be augmented
bun run scripts/augment-existing-guides.ts --dry-run

# Augment all guides with default settings
bun run scripts/augment-existing-guides.ts

# Custom parameters
bun run scripts/augment-existing-guides.ts --max-products 5 --threshold 0.4

# Process specific files
bun run scripts/augment-existing-guides.ts --pattern "backpack.*\.mdx$"
```

### 3. API Usage

The augmentation functionality is available via REST API:

```bash
# Full augmentation pipeline
curl -X POST http://localhost:8787/api/guides/augment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "content": "When planning a backpacking trip, a lightweight tent is essential...",
    "maxProductsPerGear": 3,
    "similarityThreshold": 0.3
  }'

# Extract gear mentions only
curl -X POST http://localhost:8787/api/guides/extract-gears \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "content": "Your guide content here..."
  }'
```

### 4. Integration with Guide Generation

Product augmentation is automatically enabled for new guides when `OPENAI_API_KEY` is available:

```typescript
import { generatePost } from './generate-content';

const request = {
  title: "Essential Hiking Gear",
  categories: ["gear-essentials"],
  generateFullContent: true,
  enableProductAugmentation: true  // Enabled by default
};

await generatePost(request);
```

## How It Works

### 1. Gear Extraction Phase

The system analyzes content using OpenAI GPT-4 with a specialized prompt to identify:

- Specific outdoor gear items (tents, backpacks, sleeping bags, etc.)
- Equipment brands and models when mentioned  
- Outdoor clothing and accessories
- Cooking, water treatment, and safety gear
- Navigation equipment

Example extraction:
```javascript
{
  "gears": [
    {
      "item": "lightweight tent",
      "category": "shelter", 
      "context": "for overnight trips"
    },
    {
      "item": "sleeping bag",
      "category": "sleep",
      "context": "rated for temperatures"
    }
  ]
}
```

### 2. Product Retrieval Phase

For each extracted gear item, the system:

1. Creates optimized search queries combining item name, category, and context
2. Uses batch vector search against the catalog database
3. Filters results by similarity threshold (default: 0.3)
4. Limits results per gear item (default: 3 products)

### 3. Content Augmentation Phase

The system intelligently places product recommendations:

- Finds paragraphs mentioning specific gear items
- Inserts product recommendations after relevant sentences
- Creates properly formatted markdown with product details
- Includes similarity scores for transparency

Example output:
```markdown
A lightweight tent provides shelter from the elements.

**Recommended lightweight tent:**
- **[MSR Hubba Hubba NX 2+ Tent](https://example.com/tent)** by MSR - $449.95 (1590g) - Similarity: 85.2%
- **[Big Agnes Copper Spur HV UL2](https://example.com/tent2)** by Big Agnes - $399.95 (1420g) - Similarity: 82.1%
```

## CLI Script Options

The `augment-existing-guides.ts` script supports various options:

```bash
# Options
--dry-run              # Run without making changes (see what would happen)
--skip-backup          # Skip creating backup files  
--max-products <n>     # Maximum products per gear item (default: 3)
--threshold <n>        # Similarity threshold 0-1 (default: 0.3)
--pattern <regex>      # Only process files matching pattern
--help, -h             # Show help message

# Examples
bun run scripts/augment-existing-guides.ts --dry-run
bun run scripts/augment-existing-guides.ts --max-products 5 --threshold 0.4
bun run scripts/augment-existing-guides.ts --pattern "tent.*\.mdx$"
```

## API Endpoints

### POST `/api/guides/augment`

Complete augmentation pipeline that extracts gear, finds products, and augments content.

**Request:**
```json
{
  "content": "string (required)",
  "maxProductsPerGear": "number (optional, default: 3)",
  "similarityThreshold": "number (optional, default: 0.3)"
}
```

**Response:**
```json
{
  "extractedGears": [
    {
      "gear": {
        "item": "lightweight tent",
        "category": "shelter",
        "context": "for overnight trips"
      },
      "products": [
        {
          "id": 12345,
          "name": "MSR Hubba Hubba NX 2+ Tent",
          "productUrl": "https://example.com/tent",
          "price": 449.95,
          "brand": "MSR",
          "similarity": 0.852,
          "weight": 1590,
          "weightUnit": "g",
          "categories": ["camping", "shelter"]
        }
      ]
    }
  ],
  "augmentedContent": "string",
  "totalProductsAdded": 12
}
```

### POST `/api/guides/extract-gears`

Extract gear mentions only (useful for analysis or preview).

**Request:**
```json
{
  "content": "string (required)"
}
```

**Response:**
```json
{
  "gears": [
    {
      "item": "lightweight tent",
      "category": "shelter",
      "context": "for overnight trips"
    }
  ]
}
```

## Configuration

### Similarity Threshold

Controls how closely products must match gear mentions (0.0 to 1.0):
- `0.1-0.3`: More lenient, includes loosely related products
- `0.3-0.5`: Balanced, good general purpose setting
- `0.5+`: Strict, only very similar products included

### Max Products Per Gear

Limits the number of product recommendations per gear item:
- `1-2`: Minimal, just the best matches
- `3`: Default, good variety without overwhelming
- `4+`: Comprehensive, for detailed product comparisons

## Error Handling

The system includes comprehensive error handling:

- **API Failures**: Graceful fallback when AI services are unavailable
- **Database Issues**: Continues processing when catalog search fails
- **File Errors**: Skips problematic files and reports errors
- **Backup Protection**: Automatic backups prevent data loss
- **Rate Limiting**: Built-in delays to respect API limits

## Performance Considerations

- **Batch Processing**: Vector searches are batched for efficiency
- **Rate Limiting**: Includes delays between API calls to avoid limits
- **Memory Management**: Processes files individually to avoid memory issues
- **Concurrent Limits**: Respects OpenAI and database connection limits

## Monitoring and Debugging

The system provides detailed logging:

```bash
# Enable debug logging
DEBUG=1 bun run scripts/augment-existing-guides.ts

# View processing statistics
bun run scripts/augment-existing-guides.ts --dry-run | grep "Summary"
```

## Integration Examples

### Custom Augmentation

```typescript
import { GearAugmentationService } from '@packrat/api/src/services/gearAugmentationService';

const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  AI_PROVIDER: 'openai' as const,
  // ... other env vars
};

const service = new GearAugmentationService(env, false);

// Extract gear only
const gears = await service.extractGearMentions(content);

// Find products for specific gears
const gearsWithProducts = await service.findProductsForGears(gears, 5, 0.2);

// Custom augmentation
const result = await service.augmentGuide(content, 3, 0.3);
```

### Frontend Integration

```javascript
// React component example
const useAugmentGuide = (content) => {
  return useMutation({
    mutationFn: async ({ content, maxProducts, threshold }) => {
      const response = await fetch('/api/guides/augment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          maxProductsPerGear: maxProducts,
          similarityThreshold: threshold
        })
      });
      return response.json();
    }
  });
};
```

## Troubleshooting

### Common Issues

**"OPENAI_API_KEY is required"**
- Set the environment variable in your `.env` file
- Ensure the API key has sufficient credits and permissions

**"Failed to find products"**
- Check database connection (`NEON_DATABASE_URL`)
- Verify catalog has products with embeddings
- Lower similarity threshold for more matches

**"No gear found"**
- Content may not contain outdoor gear mentions
- Try with more specific outdoor/camping content
- Check OpenAI API response for errors

**"Memory issues during processing"**
- Process files in smaller batches
- Use `--pattern` to limit file selection
- Increase system memory allocation

### Debug Mode

```bash
# Enable verbose logging
DEBUG=1 bun run scripts/augment-existing-guides.ts --dry-run

# Check specific file processing
bun run scripts/augment-existing-guides.ts --pattern "specific-file.mdx" --dry-run
```

## Contributing

When contributing to the augmentation system:

1. Add tests for new functionality in `packages/api/test/services/`
2. Update schemas in `packages/api/src/schemas/gearAugmentation.ts`
3. Follow existing error handling patterns
4. Include proper TypeScript types
5. Add performance monitoring for new features

## License

This module is part of the PackRat project and follows the same licensing terms.