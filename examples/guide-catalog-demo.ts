#!/usr/bin/env bun
/**
 * Example script demonstrating the catalog search tool for guides
 * This shows how to integrate catalog search into guide generation
 * 
 * Usage:
 * bun run examples/guide-catalog-demo.ts
 */

import chalk from 'chalk';
import { GuideCatalogSearchTool } from '../packages/api/src/utils/guideCatalogSearch';
import type { Env } from '../packages/api/src/utils/env-validation';

// Initialize environment
function getEnv(): Env {
  return {
    NEON_DATABASE_URL: process.env.NEON_DATABASE_URL || '',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    AI_PROVIDER: (process.env.AI_PROVIDER as any) || 'openai',
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    CLOUDFLARE_AI_GATEWAY_ID: process.env.CLOUDFLARE_AI_GATEWAY_ID || '',
  } as Env;
}

async function demonstrateCatalogSearch() {
  console.log(chalk.blue('\n🏕️ Guide Catalog Search Tool Demo\n'));

  try {
    const searchTool = new GuideCatalogSearchTool(getEnv());

    // Example 1: Basic search
    console.log(chalk.yellow('1. Basic catalog search for "backpack":'));
    const backpackResults = await searchTool.searchCatalogForGuides('backpack', {
      limit: 3,
      minRating: 4.0
    });
    
    if (backpackResults.items.length > 0) {
      console.log(chalk.green(`Found ${backpackResults.total} backpack(s):`));
      backpackResults.items.forEach(item => {
        const rating = item.ratingValue ? ` ⭐ ${item.ratingValue.toFixed(1)}` : '';
        const price = item.price ? ` ($${item.price.toFixed(2)})` : '';
        console.log(`  • ${item.name}${rating}${price}`);
        console.log(`    ${chalk.dim(item.productUrl)}`);
      });
      
      // Show how to format as recommendation list
      console.log(chalk.cyan('\nFormatted as recommendations:'));
      console.log(searchTool.formatRecommendationsList(backpackResults.items, 'Top Backpacks'));
    } else {
      console.log(chalk.red('No backpacks found matching criteria'));
    }

    // Example 2: Extract gear terms from guide content
    console.log(chalk.yellow('\n2. Extracting gear terms from sample guide content:'));
    const sampleContent = `
      For your next backpacking trip, you'll need essential gear including:
      - A reliable tent for shelter
      - A warm sleeping bag rated for the conditions
      - A comfortable backpack to carry everything
      - A headlamp for navigation in the dark
      - A water filter to ensure safe drinking water
      - A camp stove for cooking meals
    `;
    
    const extractedTerms = searchTool.extractGearTerms(sampleContent);
    console.log(chalk.green(`Extracted terms: ${extractedTerms.join(', ')}`));

    // Example 3: Batch search for extracted terms
    console.log(chalk.yellow('\n3. Batch searching for extracted terms:'));
    const batchResults = await searchTool.batchSearchCatalogForGuides(extractedTerms, {
      limit: 2,
      minRating: 3.5
    });

    for (const [term, result] of Object.entries(batchResults)) {
      if (result.items.length > 0) {
        console.log(chalk.green(`\n${term}:`));
        result.items.forEach(item => {
          const link = searchTool.formatCatalogLink(item);
          console.log(`  ${link}`);
        });
      }
    }

    // Example 4: Category-specific search
    console.log(chalk.yellow('\n4. Category-specific search (shelter):'));
    const shelterResults = await searchTool.searchCatalogForGuides('tent', {
      category: 'shelter',
      limit: 3
    });

    if (shelterResults.items.length > 0) {
      console.log(chalk.green('Shelter items:'));
      shelterResults.items.forEach(item => {
        console.log(`  • ${item.name} (${item.categories?.join(', ')})`);
      });
    }

    console.log(chalk.blue('\n✅ Demo completed successfully!'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Demo failed:'), error);
    
    if (!process.env.NEON_DATABASE_URL) {
      console.log(chalk.yellow('\n💡 Tip: Make sure NEON_DATABASE_URL is set in your environment'));
    }
    
    process.exit(1);
  }
}

// Example of how to integrate with guide generation
function showGuideGenerationIntegration() {
  console.log(chalk.blue('\n📝 Guide Generation Integration Example:\n'));
  
  console.log(chalk.dim(`
// In your guide generation script:
import { GuideCatalogSearchTool } from '../packages/api/src/utils/guideCatalogSearch';

async function generateGuideWithCatalogLinks(title: string, content: string) {
  const searchTool = new GuideCatalogSearchTool(env);
  
  // Extract gear terms from the content
  const gearTerms = searchTool.extractGearTerms(title + ' ' + content);
  
  // Search catalog for relevant items
  const catalogResults = await searchTool.batchSearchCatalogForGuides(gearTerms, {
    limit: 3,
    minRating: 4.0
  });
  
  // Generate recommendations section
  const allItems = Object.values(catalogResults).flatMap(r => r.items);
  const uniqueItems = allItems.filter((item, index, self) => 
    index === self.findIndex(t => t.id === item.id)
  );
  
  const recommendationsSection = searchTool.formatRecommendationsList(
    uniqueItems.slice(0, 6), 
    'Recommended Gear'
  );
  
  // Add recommendations to your guide content
  return content + recommendationsSection;
}
  `));
}

// Run the demo
if (import.meta.main) {
  demonstrateCatalogSearch()
    .then(() => {
      showGuideGenerationIntegration();
    })
    .catch(console.error);
}

export { demonstrateCatalogSearch };