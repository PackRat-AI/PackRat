import chalk from 'chalk';
import { enhanceGuideContent, validateCatalogApi } from '../lib/contentEnhancement';

// Test content for enhancement
const TEST_CONTENT = `
# Essential Hiking Gear for Beginners

Hiking is one of the most rewarding outdoor activities, but having the right gear can make all the difference between a memorable adventure and a challenging experience.

## Footwear

Your choice of footwear is crucial for a successful hike. You need boots that provide good ankle support and traction on various terrains. Look for waterproof materials and proper ventilation.

## Backpack

A good backpack should distribute weight evenly and have multiple compartments for organization. Consider the duration of your hike when choosing size - day hikes require smaller packs than multi-day adventures.

## Navigation

Getting lost on the trail is a serious concern. Always carry proper navigation tools and know how to use them before heading out.

## Water and Nutrition

Staying hydrated and maintaining energy levels is critical. Pack more water than you think you need, and bring high-energy snacks.

## Weather Protection

Weather conditions can change rapidly in the mountains. Be prepared with appropriate layers and rain protection.

## Safety Equipment  

Basic safety items can be lifesavers in emergency situations. Every hiker should carry essential safety gear regardless of the difficulty of the trail.

## Conclusion

With the right preparation and gear, hiking becomes an incredibly enjoyable way to connect with nature and stay active. Start with shorter trails and gradually work your way up to more challenging adventures.
`;

async function testEnhancement(): Promise<void> {
  console.log(chalk.blue('🧪 Testing Content Enhancement Module'));
  console.log(chalk.gray('═'.repeat(50)));

  try {
    // Test 1: API Connection Validation
    console.log(chalk.blue('\n1. Testing API Connection...'));
    const isApiValid = await validateCatalogApi({
      apiBaseUrl: 'http://localhost:8787',
      apiKey: process.env.OPENAI_API_KEY,
    });

    if (!isApiValid) {
      console.error(chalk.red('❌ API connection failed. Please ensure:'));
      console.error(chalk.red('   - The PackRat API is running on localhost:8787'));
      console.error(chalk.red('   - OPENAI_API_KEY environment variable is set'));
      console.error(chalk.red('   - The vector search endpoint is accessible'));
      return;
    }

    console.log(chalk.green('✅ API connection validated successfully'));

    // Test 2: Content Enhancement
    console.log(chalk.blue('\n2. Testing Content Enhancement...'));
    console.log(chalk.gray('Original content length:'), TEST_CONTENT.length, 'characters');

    const result = await enhanceGuideContent(TEST_CONTENT, {
      temperature: 0.3,
      maxSearchResults: 3,
      apiBaseUrl: 'http://localhost:8787',
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log(chalk.green('✅ Content enhancement completed'));
    console.log(chalk.gray('Enhanced content length:'), result.content.length, 'characters');
    console.log(chalk.blue('📦 Products found:'), result.productsUsed.length);

    if (result.productsUsed.length > 0) {
      console.log(chalk.yellow('\nProducts integrated:'));
      result.productsUsed.forEach((product, index) => {
        console.log(chalk.gray(`   ${index + 1}. ${product.name}`));
        console.log(chalk.gray(`      Context: ${product.context}`));
        if (product.similarity) {
          console.log(chalk.gray(`      Similarity: ${(product.similarity * 100).toFixed(1)}%`));
        }
        console.log(chalk.gray(`      URL: ${product.url}`));
      });

      console.log(chalk.blue('\n📝 Enhanced Content Preview:'));
      console.log(chalk.gray('─'.repeat(50)));
      const preview = result.content.substring(0, 800) + (result.content.length > 800 ? '...' : '');
      console.log(preview);
      console.log(chalk.gray('─'.repeat(50)));
    } else {
      console.log(chalk.yellow('⚠️  No relevant products were found for this content'));
    }

    console.log(chalk.green('\n🎉 All tests completed successfully!'));
  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testEnhancement().catch((error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}
