# Catalog Link Enhancement System

This module provides AI-powered semantic and contextual blending of catalog item links into hiking guide content. It intelligently analyzes guide text to identify relevant gear mentions and seamlessly inserts links to matching catalog items.

## Features

- **Semantic Analysis**: Uses AI to extract gear keywords and context from guide content
- **Vector Search Integration**: Leverages the existing catalog vector search API for relevant item matching
- **Contextual Link Insertion**: Intelligently places links where they fit naturally in the content
- **Configurable Options**: Customizable similarity thresholds, link limits, and enhancement parameters
- **Batch Processing**: Can enhance multiple existing guides at once
- **Fallback Mechanisms**: Works even when AI services are unavailable using pattern-based extraction

## Architecture

### Core Components

1. **CatalogLinkBlender** (`lib/catalog-link-blender.ts`)
   - Main class for content enhancement
   - Handles semantic analysis and link insertion
   - Integrates with catalog vector search API

2. **EnhancedContentGenerator** (`lib/enhanced-content-generator.ts`) 
   - Higher-level wrapper for guide generation and enhancement
   - Handles file operations and batch processing
   - Integrates with existing guide generation workflow

3. **CLI Interface** (`scripts/enhance-guides.ts`)
   - Command-line tool for easy usage
   - Supports generation, enhancement, and batch operations

### Integration Points

- **Catalog API**: Uses `/api/catalog/vector-search` endpoint from `packages/api`
- **AI Services**: Leverages OpenAI for semantic analysis (with fallbacks)
- **Guide System**: Integrates with existing content generation in `scripts/generate-content.ts`

## Usage

### Generate New Enhanced Guide

```bash
bun scripts/enhance-guides.ts generate "Essential Hiking Gear" "Complete guide to hiking equipment" \
  --categories gear-essentials beginner-resources \
  --difficulty "All Levels" \
  --max-links 5
```

### Enhance Existing Guide

```bash
bun scripts/enhance-guides.ts enhance content/posts/hiking-gear.mdx
```

### Batch Enhance All Guides

```bash
bun scripts/enhance-guides.ts batch-enhance
```

### Test API Connection

```bash
bun scripts/enhance-guides.ts test-api --api-url http://localhost:8787
```

## Configuration

### BlendingOptions

```typescript
interface BlendingOptions {
  maxLinksPerArticle?: number;      // Default: 5
  minSimilarityThreshold?: number;  // Default: 0.7
  contextWindowSize?: number;       // Default: 200
  prioritizeNewContent?: boolean;   // Default: true
}
```

### Environment Variables

- `OPENAI_API_KEY`: Required for AI-powered semantic analysis (fallback available)
- `PACKRAT_API_URL`: Base URL for the catalog API (default: http://localhost:8787)
- `PACKRAT_API_KEY`: Authentication key for catalog API access

## How It Works

### 1. Semantic Analysis

The system analyzes guide content to extract:
- Primary outdoor gear keywords
- Specific product mentions and brands
- Contextual phrases around gear mentions

**AI-Powered Analysis**: Uses GPT-4 to intelligently identify gear mentions
**Fallback Method**: Pattern-based extraction using regex for common gear terms

### 2. Catalog Matching

For each extracted keyword/phrase:
- Queries the catalog vector search API
- Filters results by similarity threshold
- Ranks matches by relevance and context fit

### 3. Link Insertion

Determines optimal insertion points by:
- Finding natural mention locations in the text
- Calculating confidence scores based on context
- Avoiding over-linking (respects maximum link limits)
- Generating appropriate link text that fits naturally

### 4. Content Enhancement

Produces enhanced markdown with:
- Contextually appropriate catalog item links
- Preserved original formatting and structure
- Optional enhanced versions (keeps originals intact)

## Example Output

### Original Content
```markdown
When backpacking overnight, a reliable tent is essential. Choose a lightweight option that provides good weather protection.
```

### Enhanced Content  
```markdown
When backpacking overnight, a reliable [tent](https://catalog.com/msr-hubba-tent) is essential. Choose a lightweight option that provides good weather protection.
```

## API Integration

### Vector Search Usage
```typescript
const result = await catalogAPI.vectorSearch('lightweight tent', 10);
// Returns: { items: CatalogItem[], total: number }
```

### Similarity Scoring
- Items matched using semantic vector similarity
- Contextual relevance scoring
- Confidence-based insertion ranking

## Testing

### Run Enhancement Test
```bash
bun scripts/test-enhancement.ts
```

This runs a comprehensive test using mock data to demonstrate the system functionality.

### Manual Testing
```bash
# Start the API server (required for real testing)
bun api

# Test API connection
bun scripts/enhance-guides.ts test-api

# Test with real content
bun scripts/enhance-guides.ts enhance content/posts/essential-hiking-gear.mdx
```

## Error Handling

- **API Failures**: Graceful degradation with informative error messages
- **AI Unavailable**: Automatic fallback to pattern-based analysis
- **Missing Content**: Validation and safe handling of malformed input
- **Rate Limiting**: Built-in delays for batch operations

## Performance Considerations

- **Batch Processing**: Includes rate limiting delays
- **Caching**: Vector search results could be cached for repeated queries
- **Fallback Speed**: Pattern-based analysis is much faster than AI
- **Memory Usage**: Processes content in manageable chunks

## Future Enhancements

1. **Smart Caching**: Cache vector search results for common queries
2. **User Preferences**: Allow users to configure enhancement preferences
3. **Link Analytics**: Track which catalog links are most effective
4. **Content Personalization**: Adapt recommendations based on user history
5. **Multi-language Support**: Extend to support non-English content
6. **Real-time Enhancement**: Live enhancement as users type in editors

## Troubleshooting

### Common Issues

1. **"AI_LoadAPIKeyError"**: Set `OPENAI_API_KEY` environment variable or the system will use fallback analysis
2. **"API request failed"**: Ensure the catalog API server is running on the specified URL
3. **"No links inserted"**: Try lowering the similarity threshold or check that catalog has relevant items
4. **"Enhancement failed"**: Check file permissions and content format

### Debug Mode
```bash
bun scripts/enhance-guides.ts enhance guide.mdx --verbose
```

Provides detailed logging of the enhancement process for debugging.