#!/usr/bin/env bun
/**
 * Complete demonstration of the catalog link enhancement system
 * This demo shows how the system would work end-to-end with real data
 */

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { CatalogLinkBlender } from '../lib/catalog-link-blender';

// Comprehensive mock catalog data that represents real outdoor gear
const mockCatalogData = [
  {
    id: 1,
    name: 'MSR Hubba Hubba NX 2-Person Tent',
    productUrl: 'https://www.rei.com/product/128692/msr-hubba-hubba-nx-2-person-backpacking-tent',
    sku: 'MSR-128692',
    weight: 1720,
    weightUnit: 'g',
    description: 'Lightweight 2-person backpacking tent with excellent ventilation and easy setup',
    categories: ['camping', 'backpacking', 'shelter', 'tents'],
    brand: 'MSR',
    model: 'Hubba Hubba NX',
    ratingValue: 4.5,
    price: 449.95,
    availability: 'in_stock' as const,
    seller: 'REI Co-op',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Osprey Atmos AG 65 Backpack',
    productUrl: 'https://www.rei.com/product/118889/osprey-atmos-ag-65-pack-mens',
    sku: 'OSP-118889',
    weight: 2100,
    weightUnit: 'g',
    description: 'Anti-Gravity suspension system provides an incredibly comfortable carry',
    categories: ['backpacking', 'hiking', 'packs', 'backpacks'],
    brand: 'Osprey',
    model: 'Atmos AG 65',
    ratingValue: 4.7,
    price: 329.95,
    availability: 'in_stock' as const,
    seller: 'REI Co-op',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 3,
    name: 'Black Diamond Spot 400 Headlamp',
    productUrl: 'https://www.rei.com/product/168326/black-diamond-spot-400-headlamp',
    sku: 'BD-168326',
    weight: 88,
    weightUnit: 'g',
    description: 'Powerful 400-lumen headlamp with multiple brightness modes and red night vision',
    categories: ['lighting', 'safety', 'electronics', 'headlamps'],
    brand: 'Black Diamond',
    model: 'Spot 400',
    ratingValue: 4.3,
    price: 59.95,
    availability: 'in_stock' as const,
    seller: 'REI Co-op',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 4,
    name: 'Patagonia Better Sweater Fleece Jacket',
    productUrl: 'https://www.patagonia.com/product/mens-better-sweater-fleece-jacket/25527.html',
    sku: 'PAT-25527',
    weight: 544,
    weightUnit: 'g',
    description: 'Classic fleece jacket made from recycled polyester with a cozy sweater-knit face',
    categories: ['clothing', 'fleece', 'insulation', 'jackets'],
    brand: 'Patagonia',
    model: 'Better Sweater',
    ratingValue: 4.6,
    price: 139.0,
    availability: 'in_stock' as const,
    seller: 'Patagonia',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 5,
    name: 'Salomon X Ultra 3 Mid GTX Hiking Boots',
    productUrl: 'https://www.rei.com/product/128491/salomon-x-ultra-3-mid-gtx-hiking-boots-mens',
    sku: 'SAL-128491',
    weight: 890,
    weightUnit: 'g',
    description: 'Waterproof Gore-Tex hiking boots with excellent traction and support',
    categories: ['footwear', 'boots', 'hiking', 'waterproof'],
    brand: 'Salomon',
    model: 'X Ultra 3 Mid GTX',
    ratingValue: 4.4,
    price: 179.95,
    availability: 'in_stock' as const,
    seller: 'REI Co-op',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 6,
    name: 'Nalgene Wide Mouth Water Bottle',
    productUrl: 'https://www.rei.com/product/787442/nalgene-wide-mouth-water-bottle-32-fl-oz',
    sku: 'NAL-787442',
    weight: 177,
    weightUnit: 'g',
    description: 'Durable BPA-free water bottle with leak-proof design',
    categories: ['hydration', 'bottles', 'water', 'accessories'],
    brand: 'Nalgene',
    model: 'Wide Mouth',
    ratingValue: 4.8,
    price: 12.95,
    availability: 'in_stock' as const,
    seller: 'REI Co-op',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 7,
    name: 'Jetboil Flash Cooking System',
    productUrl: 'https://www.rei.com/product/830259/jetboil-flash-cooking-system',
    sku: 'JET-830259',
    weight: 371,
    weightUnit: 'g',
    description: 'Ultra-compact cooking system that boils water in 100 seconds',
    categories: ['cooking', 'stoves', 'backpacking', 'gear'],
    brand: 'Jetboil',
    model: 'Flash',
    ratingValue: 4.5,
    price: 89.95,
    availability: 'in_stock' as const,
    seller: 'REI Co-op',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

// Enhanced mock API that provides realistic search behavior
class RealisticMockCatalogAPI {
  private items = mockCatalogData;

  async vectorSearch(query: string, limit = 10) {
    const queryLower = query.toLowerCase();

    // Simulate vector similarity scoring based on text matching
    const scoredItems = this.items.map((item) => {
      let similarity = 0;

      // Name matching (highest weight)
      if (item.name.toLowerCase().includes(queryLower)) {
        similarity += 0.4;
      }

      // Category matching
      const categoryMatch = item.categories.some(
        (cat) => cat.toLowerCase().includes(queryLower) || queryLower.includes(cat.toLowerCase()),
      );
      if (categoryMatch) {
        similarity += 0.3;
      }

      // Brand matching
      if (item.brand?.toLowerCase().includes(queryLower)) {
        similarity += 0.2;
      }

      // Description matching
      if (item.description.toLowerCase().includes(queryLower)) {
        similarity += 0.1;
      }

      // Fuzzy matching for related terms
      const relatedTerms: Record<string, string[]> = {
        tent: ['shelter', 'camping', 'backpacking'],
        backpack: ['pack', 'bag', 'hiking'],
        headlamp: ['light', 'lighting', 'flashlight'],
        boots: ['footwear', 'shoes', 'hiking'],
        fleece: ['jacket', 'clothing', 'insulation'],
        'water bottle': ['hydration', 'bottle', 'water'],
        stove: ['cooking', 'cook', 'boil'],
      };

      for (const [term, related] of Object.entries(relatedTerms)) {
        if (queryLower.includes(term)) {
          const hasRelated = related.some(
            (rel) =>
              item.categories.includes(rel) ||
              item.description.toLowerCase().includes(rel) ||
              item.name.toLowerCase().includes(rel),
          );
          if (hasRelated) {
            similarity += 0.15;
          }
        }
      }

      return {
        ...item,
        similarity: Math.min(similarity, 1), // Cap at 1.0
      };
    });

    // Filter and sort by similarity
    const filtered = scoredItems
      .filter((item) => item.similarity > 0.1) // Minimum relevance threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return {
      items: filtered,
      total: filtered.length,
    };
  }
}

// Sample guide content that mentions various gear types
const sampleGuideContent = `# The Complete Beginner's Guide to Overnight Backpacking

Planning your first overnight backpacking trip can feel overwhelming, but with the right gear and preparation, it can be an incredible adventure. This comprehensive guide will walk you through everything you need to know.

## Essential Gear for Your First Trip

### Shelter System

Your tent is your home away from home on the trail. For beginners, I recommend starting with a 2-person tent even if you're hiking solo - the extra space is worth the small weight penalty. Look for something lightweight yet durable, with good ventilation to prevent condensation.

A quality sleeping bag rated for the expected temperatures is crucial. Don't forget a sleeping pad for insulation and comfort - your body will thank you in the morning.

### Pack Selection

Choose a backpack that fits your torso length properly. For weekend trips, a 40-50 liter pack should suffice, but if you're planning longer adventures, consider a 65-liter option. Make sure to get it properly fitted at an outdoor store.

Pack organization is key - use stuff sacks and compression straps to keep everything tidy and accessible.

### Navigation and Safety

A reliable headlamp is absolutely essential for any backpacking trip. Choose one with at least 200 lumens and always carry extra batteries. Consider bringing a backup light source as well.

Don't rely solely on your smartphone for navigation. Carry a map and compass, and know how to use them. GPS devices are great supplements but should never be your only navigation tool.

### Clothing and Footwear

Layer your clothing system with moisture-wicking base layers, insulating mid-layers like a fleece jacket, and a waterproof outer shell. Quality hiking boots with good ankle support can prevent injuries on rough terrain.

### Hydration and Cooking

Bring more water than you think you'll need, or plan reliable water sources along your route. A durable water bottle is essential - I prefer wide-mouth designs for easy filling and cleaning.

For cooking, a simple camp stove setup is usually sufficient for beginners. Look for compact, efficient models that can quickly boil water for dehydrated meals.

## Packing Tips

### Weight Distribution

Pack heavy items close to your back and center of gravity. Keep frequently used items accessible in side pockets or the top of your pack.

### Waterproofing

Use dry bags or pack liners to keep essential gear dry. Even "waterproof" packs can leak in heavy rain.

## Safety Considerations

Always tell someone your planned route and expected return time. Carry a first aid kit and know basic wilderness first aid. Consider carrying a satellite communicator for emergencies in remote areas.

## Conclusion

Your first overnight backpacking trip doesn't need to be perfect. Start with shorter, easier routes close to home, and gradually build your skills and confidence. Focus on having the right basic gear and learning fundamental skills before tackling more challenging adventures.

Remember, the best gear is the gear you know how to use properly. Take time to practice setting up your tent and using your stove at home before heading out on the trail.`;

async function runCompleteDemo(): Promise<void> {
  console.log(chalk.blue('🏔️  Complete Catalog Link Enhancement Demo\n'));

  // Step 1: Show the original content
  console.log(chalk.blue('📖 Original Guide Content:'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(`${sampleGuideContent.slice(0, 500)}...`);
  console.log(chalk.gray('─'.repeat(60)));
  console.log(
    chalk.yellow(`📊 Original content length: ${sampleGuideContent.length} characters\n`),
  );

  // Step 2: Initialize the enhancement system
  console.log(chalk.blue('🔧 Initializing Enhancement System...'));
  const mockAPI = new RealisticMockCatalogAPI();
  const blender = new CatalogLinkBlender(mockAPI as any, {
    maxLinksPerArticle: 6,
    minSimilarityThreshold: 0.6,
    contextWindowSize: 150,
  });

  console.log(chalk.green('✅ System initialized with mock catalog API'));
  console.log(chalk.blue(`📦 Mock catalog contains ${mockCatalogData.length} items\n`));

  // Step 3: Show what the system would search for
  console.log(chalk.blue('🔍 Semantic Analysis (Fallback Mode):'));

  // Since we don't have OpenAI key, we'll demonstrate what the fallback extraction finds
  const blenderInstance = blender as any; // Access private method for demo
  const semantics = blenderInstance.extractBasicKeywords(sampleGuideContent);

  console.log(chalk.green(`🎯 Found ${semantics.primaryKeywords.length} primary keywords:`));
  semantics.primaryKeywords.slice(0, 8).forEach((keyword: string, i: number) => {
    console.log(`   ${i + 1}. ${keyword}`);
  });

  console.log(chalk.green(`\n🛠️  Found ${semantics.gearMentions.length} gear mentions:`));
  semantics.gearMentions.slice(0, 6).forEach((mention: string, i: number) => {
    console.log(`   ${i + 1}. ${mention}`);
  });

  // Step 4: Demonstrate catalog search
  console.log(chalk.blue('\n🔎 Catalog Search Results:'));
  for (const keyword of semantics.primaryKeywords.slice(0, 4)) {
    const results = await mockAPI.vectorSearch(keyword, 3);
    if (results.items.length > 0) {
      console.log(chalk.yellow(`\n"${keyword}" matches:`));
      results.items.forEach((item, i) => {
        console.log(`   ${i + 1}. ${item.name} (${(item.similarity * 100).toFixed(1)}% match)`);
      });
    }
  }

  // Step 5: Perform the full enhancement
  console.log(chalk.blue('\n🚀 Enhancing Content with Catalog Links...'));

  const result = await blender.enhanceGuideContent(sampleGuideContent, {
    title: "The Complete Beginner's Guide to Overnight Backpacking",
    categories: ['beginner-resources', 'gear-essentials', 'trip-planning'],
    difficulty: 'Beginner',
  });

  console.log(chalk.green(`✅ Enhancement Complete!`));
  console.log(chalk.blue(`🔗 Links inserted: ${result.insertedLinks.length}`));
  console.log(chalk.blue(`💡 Total suggestions considered: ${result.suggestions.length}`));

  // Step 6: Show the results
  if (result.insertedLinks.length > 0) {
    console.log(chalk.blue('\n📋 Inserted Catalog Links:'));
    result.insertedLinks.forEach((link, i) => {
      console.log(`${i + 1}. ${chalk.green(link.linkText)} → ${link.item.name}`);
      console.log(`   ${chalk.gray('Context:')} ...${link.context.trim().slice(-50)}...`);
      console.log(`   ${chalk.gray('URL:')} ${link.item.productUrl}`);
    });
  }

  // Step 7: Show enhanced content sample
  console.log(chalk.blue('\n📄 Enhanced Content Sample:'));
  console.log(chalk.gray('─'.repeat(60)));
  const enhancedLines = result.enhancedContent.split('\n');
  const sampleLines = enhancedLines.slice(10, 25); // Show middle section with likely links
  console.log(sampleLines.join('\n'));
  console.log(chalk.gray('─'.repeat(60)));

  // Step 8: Count and show link statistics
  const linkMatches = result.enhancedContent.match(/\[.*?\]\(.*?\)/g) || [];
  console.log(chalk.blue(`\n📊 Enhancement Statistics:`));
  console.log(`• Original length: ${sampleGuideContent.length} characters`);
  console.log(`• Enhanced length: ${result.enhancedContent.length} characters`);
  console.log(`• Links added: ${linkMatches.length}`);
  console.log(`• Characters added: ${result.enhancedContent.length - sampleGuideContent.length}`);

  if (linkMatches.length > 0) {
    console.log(chalk.blue('\n🔗 Link Markdown Examples:'));
    linkMatches.slice(0, 3).forEach((link, i) => {
      console.log(`${i + 1}. ${chalk.cyan(link)}`);
    });
  }

  // Step 9: Save demo output
  console.log(chalk.blue('\n💾 Saving Demo Results...'));
  const outputDir = path.join(process.cwd(), 'demo-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = path.join(outputDir, `enhanced-demo-${timestamp}.md`);

  const demoOutput = `# Catalog Enhancement Demo Results

Generated: ${new Date().toISOString()}

## Original Content
${sampleGuideContent}

## Enhanced Content
${result.enhancedContent}

## Enhancement Summary
- Links inserted: ${result.insertedLinks.length}
- Total suggestions: ${result.suggestions.length}
- Original length: ${sampleGuideContent.length} characters
- Enhanced length: ${result.enhancedContent.length} characters

## Inserted Links
${result.insertedLinks
  .map((link, i) => `${i + 1}. [${link.linkText}](${link.item.productUrl}) - ${link.item.name}`)
  .join('\n')}

## Available Catalog Items
${mockCatalogData
  .map((item, i) => `${i + 1}. ${item.name} - $${item.price} (${item.brand})`)
  .join('\n')}
`;

  fs.writeFileSync(outputFile, demoOutput);
  console.log(chalk.green(`✅ Demo results saved to: ${outputFile}`));

  console.log(chalk.green('\n🎉 Demo Complete! '));
  console.log(chalk.blue('The catalog link enhancement system successfully:'));
  console.log('  ✓ Analyzed guide content for gear mentions');
  console.log('  ✓ Searched catalog for relevant items');
  console.log('  ✓ Inserted contextually appropriate links');
  console.log('  ✓ Preserved original content structure');
  console.log('  ✓ Generated enhanced content with product links');
}

// Run the demo if this script is executed directly
if (import.meta.main) {
  runCompleteDemo().catch((error) => {
    console.error(chalk.red('❌ Demo failed:', error));
    process.exit(1);
  });
}

export { runCompleteDemo };
