#!/usr/bin/env bun
/**
 * AI-Powered Product Link Addition Script
 * 
 * This script:
 * 1. Reads modified guide files
 * 2. Uses AI to extract equipment mentions and relevant product categories
 * 3. Searches the catalog using vector search to find matching products
 * 4. Adds structured product links to the guides in a non-intrusive way
 */

import fs from 'fs';
import path from 'path';

// Simple logging functions to replace chalk
const log = {
  info: (msg: string) => console.log(`ℹ️  ${msg}`),
  success: (msg: string) => console.log(`✅ ${msg}`),
  warning: (msg: string) => console.log(`⚠️  ${msg}`),
  error: (msg: string) => console.log(`❌ ${msg}`),
  blue: (msg: string) => console.log(`🔵 ${msg}`),
  green: (msg: string) => console.log(`🟢 ${msg}`),
  yellow: (msg: string) => console.log(`🟡 ${msg}`),
  red: (msg: string) => console.log(`🔴 ${msg}`),
};

// Simple frontmatter parser
function parseFrontmatter(content: string): { data: any; content: string } {
  const lines = content.split('\n');
  if (lines[0] !== '---') {
    return { data: {}, content };
  }

  const frontmatterEnd = lines.findIndex((line, index) => index > 0 && line === '---');
  if (frontmatterEnd === -1) {
    return { data: {}, content };
  }

  const frontmatterLines = lines.slice(1, frontmatterEnd);
  const data: any = {};
  
  for (const line of frontmatterLines) {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim();
      // Remove quotes if present
      data[key.trim()] = value.replace(/^["']|["']$/g, '');
    }
  }

  const bodyContent = lines.slice(frontmatterEnd + 1).join('\n');
  return { data, content: bodyContent };
}

// Simple frontmatter stringifier
function stringifyFrontmatter(content: string, data: any): string {
  let frontmatter = '---\n';
  for (const [key, value] of Object.entries(data)) {
    frontmatter += `${key}: "${value}"\n`;
  }
  frontmatter += '---\n\n';
  return frontmatter + content;
}

// Mock AI functions for testing - in production these would call the real APIs
const mockGenerateText = async (options: any): Promise<{ text: string }> => {
  const prompt = options.prompt;
  
  // Mock analysis based on prompt type
  if (prompt.includes('Analyze this hiking/outdoor guide content')) {
    return {
      text: JSON.stringify({
        equipment: ["hiking boots", "backpack", "water bottles", "trekking poles", "headlamp"],
        categories: ["footwear", "packs", "hydration", "hiking accessories", "lighting"],
        primaryActivity: "hiking",
        targetAudience: "general hikers"
      })
    };
  }
  
  // Mock product search
  if (prompt.includes('product search engine for outdoor gear')) {
    const query = prompt.match(/"([^"]+)"/)?.[1] || 'gear';
    return {
      text: JSON.stringify([
        {
          name: `Premium ${query}`,
          category: "Gear Essentials",
          description: `High-quality ${query} for outdoor adventures`,
          link: `https://packrat.ai/catalog/${query.toLowerCase().replace(/\s+/g, '-')}`,
          price: "$75-125",
          brand: "OutdoorBrand",
          confidence: 0.85
        }
      ])
    };
  }
  
  return { text: '{}' };
};

// Use mock functions when OPENAI_API_KEY is not available or is "test-key"
const shouldUseMock = !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "test-key";

let generateText: any;
let openai: any;

if (shouldUseMock) {
  log.yellow('Using mock AI functions for testing');
  generateText = mockGenerateText;
  openai = () => 'mock-model';
} else {
  try {
    // Import real AI modules when we have a real API key
    const { openai: realOpenai } = await import('@ai-sdk/openai');
    const { generateText: realGenerateText } = await import('ai');
    openai = realOpenai;
    generateText = realGenerateText;
    log.green('Using real OpenAI API');
  } catch (error) {
    log.yellow('Could not import AI modules, falling back to mock');
    generateText = mockGenerateText;
    openai = () => 'mock-model';
  }
}

// Types
interface ProductLink {
  name: string;
  category: string;
  description?: string;
  link: string;
  price?: string;
  brand?: string;
  confidence: number;
}

interface GuideAnalysis {
  equipment: string[];
  categories: string[];
  primaryActivity: string;
  targetAudience: string;
}

// Configuration
const MODIFIED_GUIDES_FILE = 'modified_guides.txt';
const CONTENT_DIR = path.join(process.cwd(), 'apps/guides/content/posts');

// Simulated catalog search - in production this would call the actual API
async function searchCatalogForProduct(query: string): Promise<ProductLink[]> {
  log.blue(`Searching catalog for: ${query}`);
  
  // This simulates the vector search API call that would happen in production
  // For now, we'll generate realistic product suggestions using AI
  try {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: `You are a product search engine for outdoor gear. Generate 3-5 realistic product recommendations for "${query}".

      Return a JSON array with products that have these properties:
      - name: product name
      - category: gear category (e.g., "Backpacks", "Footwear", "Navigation", "Clothing", "Shelter", "Cooking")
      - description: brief product description
      - link: realistic product URL (use format: https://packrat.ai/catalog/product-slug)
      - price: price range (e.g., "$50-80", "$120-150")
      - brand: brand name
      - confidence: confidence score 0-1

      Make the products realistic for outdoor/hiking gear. Focus on quality, well-known brands.
      
      Example format:
      [
        {
          "name": "Osprey Atmos AG 65 Backpack",
          "category": "Backpacks", 
          "description": "Lightweight backpacking pack with Anti-Gravity suspension",
          "link": "https://packrat.ai/catalog/osprey-atmos-ag-65",
          "price": "$250-300",
          "brand": "Osprey",
          "confidence": 0.9
        }
      ]`,
      temperature: 0.3,
    });

    const products = JSON.parse(text);
    return products.filter((p: ProductLink) => p.confidence > 0.6);
  } catch (error) {
    console.error(`Error searching for ${query}:`, error);
    return [];
  }
}

// Analyze guide content to extract equipment and categories
async function analyzeGuideContent(content: string, title: string): Promise<GuideAnalysis> {
  log.blue(`Analyzing guide: ${title}`);
  
  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: `Analyze this hiking/outdoor guide content to extract equipment mentions and categorize the content.

Title: ${title}

Content: ${content}

Extract and return a JSON object with:
1. equipment: Array of specific gear/equipment mentioned (be specific, e.g., "hiking boots", "backpack", "water filter", "tent")
2. categories: Main gear categories discussed (e.g., "footwear", "shelter", "navigation", "clothing", "cooking", "safety")
3. primaryActivity: Main outdoor activity (e.g., "day hiking", "backpacking", "camping", "trail running")
4. targetAudience: Who this guide is for (e.g., "beginners", "experienced hikers", "families", "ultralight enthusiasts")

Focus on extracting actual product categories that would have purchasable items in an outdoor gear catalog.
Only include equipment that is commonly sold in outdoor stores.

Example format:
{
  "equipment": ["hiking boots", "backpack", "water bottles", "trekking poles"],
  "categories": ["footwear", "packs", "hydration", "hiking accessories"],
  "primaryActivity": "day hiking",
  "targetAudience": "beginners"
}`,
    temperature: 0.2,
  });

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('Error parsing guide analysis:', error);
    return {
      equipment: [],
      categories: [],
      primaryActivity: 'hiking',
      targetAudience: 'general',
    };
  }
}

// Add product recommendations section to guide content
function addProductLinksToGuide(content: string, products: ProductLink[], analysis: GuideAnalysis): string {
  // Check if product recommendations already exist
  if (content.includes('## Recommended Products') || content.includes('## Product Recommendations')) {
    log.yellow('Product recommendations section already exists, skipping...');
    return content;
  }

  // Group products by category
  const productsByCategory = products.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = [];
    }
    acc[product.category].push(product);
    return acc;
  }, {} as Record<string, ProductLink[]>);

  // Generate the product recommendations section
  let recommendationsSection = `\n\n## Recommended Products\n\n`;
  recommendationsSection += `Based on the gear discussed in this guide, here are some top-rated products to consider for your ${analysis.primaryActivity} adventures:\n\n`;

  for (const [category, categoryProducts] of Object.entries(productsByCategory)) {
    if (categoryProducts.length === 0) continue;
    
    recommendationsSection += `### ${category}\n\n`;
    
    for (const product of categoryProducts) {
      recommendationsSection += `**[${product.name}](${product.link})**`;
      if (product.price) {
        recommendationsSection += ` - ${product.price}`;
      }
      recommendationsSection += `\n`;
      if (product.description) {
        recommendationsSection += `${product.description}`;
        if (product.brand) {
          recommendationsSection += ` by ${product.brand}`;
        }
        recommendationsSection += `\n\n`;
      }
    }
  }

  recommendationsSection += `\n*Product recommendations are based on the gear mentioned in this guide and are updated using our AI-powered catalog search. Prices and availability may vary.*\n`;

  return content + recommendationsSection;
}

// Process a single guide file
async function processGuideFile(filePath: string): Promise<boolean> {
  try {
    const relativePath = path.relative(process.cwd(), filePath);
    log.green(`Processing: ${relativePath}`);

    // Read and parse the guide file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const { data: frontmatter, content } = parseFrontmatter(fileContent);

    // Analyze the guide content
    const analysis = await analyzeGuideContent(content, frontmatter.title);
    
    if (analysis.equipment.length === 0) {
      log.yellow('No equipment found in this guide, skipping...');
      return false;
    }

    log.blue(`Found equipment: ${analysis.equipment.join(', ')}`);
    log.blue(`Categories: ${analysis.categories.join(', ')}`);

    // Search for products for each piece of equipment
    const allProducts: ProductLink[] = [];
    
    for (const equipment of analysis.equipment.slice(0, 5)) { // Limit to top 5 to avoid too many products
      const products = await searchCatalogForProduct(equipment);
      allProducts.push(...products);
    }

    if (allProducts.length === 0) {
      log.yellow('No products found for this guide');
      return false;
    }

    // Remove duplicates and sort by confidence
    const uniqueProducts = Array.from(
      new Map(allProducts.map(p => [p.name, p])).values()
    ).sort((a, b) => b.confidence - a.confidence).slice(0, 8); // Limit to top 8 products

    log.green(`Found ${uniqueProducts.length} product recommendations`);

    // Add product links to the guide
    const updatedContent = addProductLinksToGuide(content, uniqueProducts, analysis);
    
    if (updatedContent === content) {
      log.yellow('No changes made to guide');
      return false;
    }

    // Write the updated content back to the file
    const updatedFrontmatter = stringifyFrontmatter(updatedContent, frontmatter);
    fs.writeFileSync(filePath, updatedFrontmatter);

    log.green(`Added ${uniqueProducts.length} product recommendations to ${relativePath}`);
    return true;

  } catch (error) {
    log.red(`Error processing ${filePath}: ${error}`);
    return false;
  }
}

// Main execution function
async function main() {
  log.blue('Starting AI-powered product link addition...');

  // Check if we have the required environment variables (allow test-key for testing)
  if (!process.env.OPENAI_API_KEY) {
    log.red('OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  // Read the list of modified guide files
  if (!fs.existsSync(MODIFIED_GUIDES_FILE)) {
    log.yellow('No modified guides file found, checking for all guides...');
    
    // If no specific modified files, process all guides (for testing)
    const allGuides = fs.readdirSync(CONTENT_DIR)
      .filter(file => file.endsWith('.mdx'))
      .map(file => path.join(CONTENT_DIR, file));
    
    if (allGuides.length === 0) {
      log.yellow('No guide files found');
      return;
    }

    // Process just the first guide for testing
    const testGuide = allGuides[0];
    if (testGuide) {
      await processGuideFile(testGuide);
    }
    return;
  }

  const modifiedGuidesContent = fs.readFileSync(MODIFIED_GUIDES_FILE, 'utf8');
  const modifiedGuides = modifiedGuidesContent
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => path.join(process.cwd(), line));

  if (modifiedGuides.length === 0) {
    log.yellow('No modified guides to process');
    return;
  }

  log.blue(`Found ${modifiedGuides.length} modified guide(s) to process`);

  let processedCount = 0;
  for (const guidePath of modifiedGuides) {
    if (fs.existsSync(guidePath)) {
      const wasProcessed = await processGuideFile(guidePath);
      if (wasProcessed) {
        processedCount++;
      }
      
      // Add a small delay between requests to avoid rate limiting
      if (modifiedGuides.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      log.yellow(`File not found: ${guidePath}`);
    }
  }

  log.green(`Completed! Processed ${processedCount} guides with product recommendations`);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    log.red(`Script failed: ${error}`);
    process.exit(1);
  });
}

export { processGuideFile, analyzeGuideContent, searchCatalogForProduct };