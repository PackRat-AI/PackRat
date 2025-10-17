# AI-Powered Product Link Addition Workflow

This GitHub Actions workflow automatically adds relevant product recommendations to modified outdoor guides using AI and the PackRat catalog vector search.

## How It Works

### Trigger
- Runs automatically when guides are modified in the `development` branch
- Specifically monitors changes to `apps/guides/content/posts/**` files

### Process
1. **Detection**: Identifies modified guide files using `git diff`
2. **Analysis**: Uses OpenAI's GPT-4 to analyze guide content and extract:
   - Equipment mentions (hiking boots, backpacks, etc.)
   - Gear categories (footwear, shelter, navigation, etc.)
   - Primary activity type (day hiking, backpacking, etc.)
   - Target audience and difficulty level

3. **Product Search**: For each piece of equipment found:
   - Queries the PackRat catalog API using vector search
   - Finds products with high similarity scores (>0.6)
   - Filters and ranks results by relevance

4. **Content Enhancement**: Adds a "Recommended Products" section containing:
   - Grouped products by category
   - Product names with links to PackRat catalog
   - Prices and brand information when available
   - Contextual descriptions

5. **Commit**: Automatically commits the enhanced guides back to the repository

### Example Output

```markdown
## 🛒 Recommended Products

*Based on the gear discussed in this guide, here are some top-rated products to consider for your hiking adventures:*

### Footwear

**[Merrell Moab 3 Hiking Boots](https://packrat.ai/catalog/merrell-moab-3)** - $120 *by Merrell*
Durable hiking boots with excellent traction and comfort for day hikes and multi-day treks.

### Packs

**[Osprey Talon 22 Daypack](https://packrat.ai/catalog/osprey-talon-22)** - $85 *by Osprey*
Lightweight daypack perfect for day hikes with integrated hydration sleeve.

---

*Product recommendations are automatically generated using AI-powered analysis of this guide's content and our comprehensive outdoor gear database. Prices and availability may vary.*
```

## Configuration

### Required Environment Variables
- `OPENAI_API_KEY`: OpenAI API key for content analysis
- `PACKRAT_API_KEY`: PackRat API key for catalog access
- `PACKRAT_API_URL`: PackRat API base URL (defaults to production)

### Required GitHub Secrets
Add these secrets to your repository settings:
- `OPENAI_API_KEY`
- `PACKRAT_API_KEY`
- `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN` (for package installation)

## Files

### `.github/workflows/add-product-links-to-guides.yml`
Main GitHub Actions workflow that:
- Triggers on pushes to development branch
- Detects modified guides
- Runs the product linking script
- Commits changes back to repository

### `.github/scripts/add-product-links-production.ts`
Production script that:
- Integrates with real PackRat API
- Uses OpenAI for content analysis
- Handles rate limiting and error recovery
- Formats product links appropriately

### `.github/scripts/add-product-links.ts`
Development/testing version with:
- Mock AI functions for testing
- Simple logging without external dependencies
- Fallback mechanisms for offline testing

## Testing

### Local Testing
```bash
# Set test environment
export OPENAI_API_KEY="test-key"

# Test with mock data
bun run .github/scripts/add-product-links.ts

# Test with real API (requires keys)
export OPENAI_API_KEY="your-real-key"
export PACKRAT_API_KEY="your-api-key"
bun run .github/scripts/add-product-links-production.ts
```

### Manual Workflow Test
1. Create or modify a guide in `apps/guides/content/posts/`
2. Push to the `development` branch
3. Check GitHub Actions for workflow execution
4. Verify product links were added to the modified guide

## Benefits

1. **Automatic Enhancement**: No manual effort required to add product links
2. **AI-Powered**: Intelligent analysis ensures relevant product suggestions
3. **SEO Friendly**: Structured product links improve search visibility
4. **Revenue Generation**: Product links support potential affiliate programs
5. **User Experience**: Readers get immediate access to recommended gear

## Limitations

- Requires valid OpenAI and PackRat API keys
- Only processes guides modified in the development branch
- Limited to 5 equipment types per guide to avoid overwhelming content
- Depends on PackRat catalog having relevant products for detected equipment

## Maintenance

### Adding New Equipment Types
The AI analysis automatically detects new equipment types, but you can enhance detection by:
1. Adding common patterns to the fallback analysis in the script
2. Training the AI with more specific prompts for specialized gear
3. Expanding the product categories in the PackRat catalog

### Monitoring
- Check GitHub Actions logs for workflow execution
- Monitor guide quality to ensure appropriate product suggestions
- Review product link performance and user engagement

## Security

- API keys are stored as GitHub Secrets (encrypted)
- Scripts validate input and sanitize content
- No external package dependencies in production script
- Automatic commit messages include `[skip ci]` to prevent infinite loops