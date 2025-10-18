#!/usr/bin/env bun

/**
 * Demo script to showcase the product augmentation functionality
 * This is for demonstration purposes and requires actual API keys to work
 */

import { GearAugmentationService } from '@packrat/api/src/services/gearAugmentationService';
import chalk from 'chalk';

// Sample guide content for demonstration
const sampleContent = `
# Essential Backpacking Gear for Beginners

## Introduction

Planning your first backpacking trip can be overwhelming with all the gear choices available. This guide covers the essential items every beginner needs for a safe and comfortable outdoor adventure.

## Shelter and Sleep System

A lightweight tent is your most important piece of gear for overnight trips. Look for something between 2-3 pounds that can handle the weather conditions you'll encounter. 

Your sleeping bag should be rated for temperatures 10-15 degrees below what you expect. Down sleeping bags offer the best warmth-to-weight ratio but lose insulation when wet.

Don't forget a sleeping pad for insulation and comfort. Closed-cell foam pads are durable and inexpensive, while inflatable pads offer more comfort.

## Clothing and Footwear  

Sturdy hiking boots provide ankle support and protection on rough terrain. Break them in before your trip to avoid blisters.

Layer your clothing using a moisture-wicking base layer, insulating mid-layer, and waterproof shell. Avoid cotton materials that retain moisture.

## Navigation and Safety

A reliable GPS device or smartphone with offline maps is essential for navigation. Always carry a backup compass and paper map.

Water purification tablets or a portable water filter ensure safe drinking water from natural sources.

Pack a comprehensive first aid kit appropriate for your group size and trip duration.

## Cooking and Food Storage

A lightweight backpacking stove and fuel canister make meal preparation easy. Look for models that work well in windy conditions.

Bear-proof food storage is required in many areas. Use bear canisters or hang your food properly using bear rope.

## Conclusion

Investing in quality gear makes your backpacking experience more enjoyable and safe. Start with the essentials and upgrade items as you gain more experience on the trail.
`;

async function demoAugmentation() {
  console.log(chalk.blue('🎯 Product Augmentation Demo'));
  console.log(chalk.blue('=============================\n'));

  // Check for required environment variables
  if (!process.env.OPENAI_API_KEY) {
    console.log(chalk.yellow('⚠️  This demo requires OPENAI_API_KEY to be set'));
    console.log(
      chalk.yellow('The demo will show the expected structure without actual API calls\n'),
    );

    // Show what the structure would look like
    console.log(chalk.blue('📄 Sample Content:'));
    console.log(chalk.gray(`${sampleContent.substring(0, 300)}...\n`));

    console.log(chalk.blue('🔍 Expected Gear Extraction (without API):'));
    const mockGears = [
      { item: 'lightweight tent', category: 'shelter', context: 'for overnight trips' },
      { item: 'sleeping bag', category: 'sleep', context: 'rated for temperatures' },
      { item: 'sleeping pad', category: 'sleep', context: 'for insulation and comfort' },
      { item: 'hiking boots', category: 'footwear', context: 'provide ankle support' },
      { item: 'GPS device', category: 'navigation', context: 'for navigation' },
      { item: 'water filter', category: 'water', context: 'ensure safe drinking water' },
      { item: 'backpacking stove', category: 'cooking', context: 'for meal preparation' },
    ];

    for (const gear of mockGears) {
      console.log(chalk.cyan(`  - ${gear.item}`), chalk.gray(`(${gear.category})`));
    }

    console.log(chalk.blue('\n🔗 Expected Augmentation Result:'));
    console.log(chalk.gray('The content would be augmented with product recommendations like:'));
    console.log(chalk.green('\n**Recommended lightweight tent:**'));
    console.log(
      chalk.green(
        '- **[MSR Hubba Hubba NX 2+ Tent](https://example.com/tent)** by MSR - $449.95 (1590g) - Similarity: 85.2%',
      ),
    );
    console.log(
      chalk.green(
        '- **[Big Agnes Copper Spur HV UL2](https://example.com/tent2)** by Big Agnes - $399.95 (1420g) - Similarity: 82.1%',
      ),
    );

    return;
  }

  try {
    console.log(chalk.blue('📄 Original Content Preview:'));
    console.log(chalk.gray(`${sampleContent.substring(0, 300)}...\n`));

    // Create environment for augmentation service
    const env = {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      AI_PROVIDER: (process.env.AI_PROVIDER || 'openai') as 'openai',
      CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
      CLOUDFLARE_AI_GATEWAY_ID: process.env.CLOUDFLARE_AI_GATEWAY_ID || '',
      AI: {},
      NEON_DATABASE_URL: process.env.NEON_DATABASE_URL || '',
    };

    const gearAugmentationService = new GearAugmentationService(env, false);

    // Step 1: Extract gear mentions
    console.log(chalk.blue('🔍 Step 1: Extracting gear mentions...'));
    const gears = await gearAugmentationService.extractGearMentions(sampleContent);

    console.log(chalk.green(`✓ Found ${gears.length} gear items:`));
    for (const gear of gears) {
      console.log(
        chalk.cyan(`  - ${gear.item}`),
        gear.category ? chalk.gray(`(${gear.category})`) : '',
      );
    }

    // Step 2 & 3: Find products and augment (this requires database connection)
    console.log(chalk.blue('\n🔗 Step 2-3: Finding products and augmenting content...'));
    console.log(chalk.yellow('⚠️  Product search requires database connection (skipped in demo)'));

    // Show what would happen with mock products
    console.log(chalk.blue('\n📝 Mock Augmentation Result:'));
    console.log(
      chalk.gray('With a populated product catalog, the content would be augmented with:'),
    );
    console.log(chalk.green('\n**Recommended lightweight tent:**'));
    console.log(
      chalk.green(
        '- **[MSR Hubba Hubba NX 2+ Tent](https://example.com/tent)** by MSR - $449.95 (1590g) - Similarity: 85.2%',
      ),
    );
    console.log(
      chalk.green(
        '- **[Big Agnes Copper Spur HV UL2](https://example.com/tent2)** by Big Agnes - $399.95 (1420g) - Similarity: 82.1%',
      ),
    );
  } catch (error) {
    console.error(chalk.red('❌ Demo failed:'), error);
  }

  console.log(chalk.blue('\n✨ Demo completed!'));
  console.log(chalk.gray('To see full functionality, ensure you have:'));
  console.log(chalk.gray('1. OPENAI_API_KEY environment variable'));
  console.log(chalk.gray('2. Database connection with populated catalog'));
  console.log(chalk.gray('3. Run: bun run apps/guides/scripts/demo-augmentation.ts'));
}

// Run the demo (following existing codebase pattern)
// eslint-disable-next-line @typescript-eslint/no-require-imports
if (require.main === module) {
  demoAugmentation().catch((error) => {
    console.error(chalk.red('Demo error:'), error);
    process.exit(1);
  });
}

export { demoAugmentation };
