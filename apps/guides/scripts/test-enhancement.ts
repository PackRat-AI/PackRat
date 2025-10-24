#!/usr/bin/env bun
/**
 * Test script for the catalog link enhancement system
 */

import chalk from 'chalk';
import { CatalogLinkBlender } from '../lib/catalog-link-blender';

// Mock catalog API for testing
class MockCatalogAPI {
  async vectorSearch(query: string, limit = 10) {
    // Return mock data that simulates catalog search results
    const mockItems = [
      {
        id: 1,
        name: 'MSR Hubba Hubba NX 2-Person Tent',
        productUrl: 'https://example.com/tent',
        sku: 'MSR-123',
        weight: 1720,
        weightUnit: 'g',
        description: 'Lightweight 2-person backpacking tent with excellent ventilation',
        categories: ['camping', 'backpacking', 'shelter'],
        images: ['https://example.com/tent.jpg'],
        brand: 'MSR',
        model: 'Hubba Hubba NX',
        ratingValue: 4.5,
        color: 'Green',
        size: '2-Person',
        price: 449.95,
        availability: 'in_stock' as const,
        seller: 'REI',
        productSku: 'REI-789',
        material: 'Nylon',
        currency: 'USD',
        condition: 'New',
        reviewCount: 127,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        similarity: 0.85,
      },
      {
        id: 2,
        name: 'Osprey Atmos AG 65 Backpack',
        productUrl: 'https://example.com/backpack',
        sku: 'OSP-456',
        weight: 2100,
        weightUnit: 'g',
        description: 'Comfortable 65L backpack with Anti-Gravity suspension system',
        categories: ['backpacking', 'hiking', 'packs'],
        images: ['https://example.com/backpack.jpg'],
        brand: 'Osprey',
        model: 'Atmos AG 65',
        ratingValue: 4.7,
        color: 'Blue',
        size: 'Medium',
        price: 329.95,
        availability: 'in_stock' as const,
        seller: 'REI',
        productSku: 'REI-456',
        material: 'Nylon',
        currency: 'USD',
        condition: 'New',
        reviewCount: 89,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        similarity: 0.82,
      },
      {
        id: 3,
        name: 'Black Diamond Spot 400 Headlamp',
        productUrl: 'https://example.com/headlamp',
        sku: 'BD-789',
        weight: 88,
        weightUnit: 'g',
        description: 'Powerful 400 lumen headlamp with multiple lighting modes',
        categories: ['lighting', 'safety', 'electronics'],
        images: ['https://example.com/headlamp.jpg'],
        brand: 'Black Diamond',
        model: 'Spot 400',
        ratingValue: 4.3,
        color: 'Black',
        size: 'One Size',
        price: 59.95,
        availability: 'in_stock' as const,
        seller: 'REI',
        productSku: 'REI-123',
        material: 'Plastic/Metal',
        currency: 'USD',
        condition: 'New',
        reviewCount: 156,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        similarity: 0.78,
      },
    ];

    // Filter items based on query relevance (simple text matching for demo)
    const filtered = mockItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query.toLowerCase()) ||
        item.categories.some((cat) => cat.toLowerCase().includes(query.toLowerCase())) ||
        item.description.toLowerCase().includes(query.toLowerCase()),
    );

    return {
      items: filtered.slice(0, limit),
      total: filtered.length,
    };
  }
}

// Sample content for testing
const sampleContent = `# Essential Hiking Gear for Every Adventure

Whether you're planning a short day hike or a multi-day backpacking trip, having the right gear is crucial for safety, comfort, and enjoyment. This guide covers the essential items every hiker should consider.

## Shelter and Sleep System

When backpacking overnight, a reliable tent is your most important piece of gear. Look for lightweight options that provide good weather protection. A 2-person tent offers a good balance of space and weight for solo hikers who want extra room or couples traveling together.

Your backpack should be properly fitted and sized for your trip length. For weekend trips, a 35-50 liter pack is usually sufficient, while longer adventures may require 65+ liters of capacity.

## Navigation and Safety

A good headlamp is essential for any hiking trip. Choose one with at least 200 lumens and multiple lighting modes. Always carry extra batteries and consider a backup light source.

Navigation tools like a compass and topographic map should complement your GPS device. Even experienced hikers can get disoriented, especially in poor weather conditions.

## Conclusion

The right gear can make the difference between an enjoyable experience and a miserable one. Start with these essentials and add items based on your specific needs, the environment, and the length of your hike.`;

async function runTest(): Promise<void> {
  try {
    console.log(chalk.blue('🧪 Testing Catalog Link Enhancement System\n'));

    // Create a mock blender for testing
    const mockAPI = new MockCatalogAPI();
    const blender = new CatalogLinkBlender(mockAPI as any, {
      maxLinksPerArticle: 3,
      minSimilarityThreshold: 0.7,
    });

    console.log(chalk.blue('📝 Sample content:'));
    console.log(chalk.gray(`${sampleContent.slice(0, 200)}...\n`));

    console.log(chalk.blue('🔍 Enhancing content with catalog links...\n'));

    const result = await blender.enhanceGuideContent(sampleContent, {
      title: 'Essential Hiking Gear for Every Adventure',
      categories: ['gear-essentials', 'beginner-resources'],
      difficulty: 'All Levels',
    });

    // Display results
    console.log(chalk.green(`✅ Enhancement completed!`));
    console.log(chalk.blue(`🔗 Links inserted: ${result.insertedLinks.length}`));
    console.log(chalk.blue(`💡 Total suggestions: ${result.suggestions.length}\n`));

    if (result.insertedLinks.length > 0) {
      console.log(chalk.blue('📋 Inserted links:'));
      result.insertedLinks.forEach((link, i) => {
        console.log(`${i + 1}. ${chalk.green(link.linkText)} -> ${link.item.name}`);
        console.log(`   ${chalk.gray('Context:')} ${link.context.slice(0, 50)}...`);
      });
      console.log();
    }

    if (result.suggestions.length > result.insertedLinks.length) {
      const remaining = result.suggestions.length - result.insertedLinks.length;
      console.log(chalk.yellow(`💭 ${remaining} additional suggestions available\n`));
    }

    // Show a preview of the enhanced content
    console.log(chalk.blue('📄 Enhanced content preview:'));
    console.log(chalk.gray('─'.repeat(50)));
    const preview = result.enhancedContent.split('\n').slice(0, 15).join('\n');
    console.log(preview);
    if (result.enhancedContent.split('\n').length > 15) {
      console.log(chalk.gray('... (content continues)'));
    }
    console.log(chalk.gray('─'.repeat(50)));

    // Count the actual links in the enhanced content
    const linkMatches = result.enhancedContent.match(/\[.*?\]\(.*?\)/g) || [];
    console.log(chalk.blue(`\n🔢 Links found in enhanced content: ${linkMatches.length}`));

    if (linkMatches.length > 0) {
      console.log(chalk.blue('🔗 Link patterns found:'));
      linkMatches.forEach((link, i) => {
        console.log(`${i + 1}. ${chalk.cyan(link)}`);
      });
    }

    console.log(chalk.green('\n🎉 Test completed successfully!'));
  } catch (error) {
    console.error(chalk.red('❌ Test failed:', error));
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (import.meta.main) {
  runTest();
}

export { runTest };
