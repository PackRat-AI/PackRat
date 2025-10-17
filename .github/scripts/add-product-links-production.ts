#!/usr/bin/env bun
/**
 * Production AI-Powered Product Link Addition Script
 * 
 * This script integrates with the actual PackRat catalog API to find real product recommendations
 * and adds them to modified guides in a structured, SEO-friendly format.
 */

import fs from 'fs';
import path from 'path';

// Simple logging functions
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

// Types
interface ProductLink {
  id: string;
  name: string;
  category: string;
  description?: string;
  link: string;
  price?: number;
  brand?: string;
  imageUrl?: string;
  similarity: number;
}

interface GuideAnalysis {
  equipment: string[];
  categories: string[];
  primaryActivity: string;
  targetAudience: string;
  difficulty: string;
}

interface ApiResponse {
  items: any[];
  total: number;
}

// Configuration
const MODIFIED_GUIDES_FILE = 'modified_guides.txt';
const CONTENT_DIR = path.join(process.cwd(), 'apps/guides/content/posts');
const API_BASE_URL = process.env.PACKRAT_API_URL || 'http://localhost:8787';

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
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    
    // Handle arrays (categories)
    if (value.startsWith('[') && value.endsWith(']')) {
      const arrayContent = value.slice(1, -1);
      data[key] = arrayContent.split(',').map(item => item.trim().replace(/^["']|["']$/g, ''));
    } else {
      // Remove quotes if present
      data[key] = value.replace(/^["']|["']$/g, '');
    }
  }

  const bodyContent = lines.slice(frontmatterEnd + 1).join('\n');
  return { data, content: bodyContent };
}

// Simple frontmatter stringifier
function stringifyFrontmatter(content: string, data: any): string {
  let frontmatter = '---\n';
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      frontmatter += `${key}: [${value.map(v => `"${v}"`).join(', ')}]\n`;
    } else {
      frontmatter += `${key}: "${value}"\n`;
    }
  }
  frontmatter += '---\n\n';
  return frontmatter + content;
}

// Call the actual PackRat catalog API
async function searchCatalogAPI(query: string): Promise<ProductLink[]> {
  try {
    log.blue(`Searching PackRat catalog API for: ${query}`);
    
    const response = await fetch(`${API_BASE_URL}/api/catalog/vector-search?q=${encodeURIComponent(query)}&limit=5`, {
      headers: {
        'Authorization': `Bearer ${process.env.PACKRAT_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      log.warning(`API request failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const data: ApiResponse = await response.json();
    
    return data.items.map(item => ({
      id: item.id || item._id || 'unknown',
      name: item.name || item.title || 'Unknown Product',
      category: item.category || 'Gear',
      description: item.description || item.short_description,
      link: item.url || `${API_BASE_URL}/catalog/${item.id}`,
      price: item.price || item.retail_price,
      brand: item.brand || item.manufacturer,
      imageUrl: item.image_url || item.image,
      similarity: item.similarity || 0.8
    })).filter(product => product.similarity > 0.6);

  } catch (error) {
    log.error(`Error searching catalog API for "${query}": ${error}`);
    return [];
  }
}

// Use AI to analyze guide content
async function analyzeGuideContentWithAI(content: string, title: string): Promise<GuideAnalysis> {
  try {
    log.blue(`Analyzing guide with AI: ${title}`);
    
    const { generateText } = await import('ai');
    const { openai } = await import('@ai-sdk/openai');
    
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: `Analyze this hiking/outdoor guide content to extract equipment mentions and categorize the content.

Title: ${title}
Content: ${content}

Extract and return a JSON object with:
1. equipment: Array of specific gear/equipment mentioned (e.g., "hiking boots", "backpack", "water filter", "tent")
2. categories: Main gear categories discussed (e.g., "footwear", "shelter", "navigation", "clothing", "cooking", "safety")
3. primaryActivity: Main outdoor activity (e.g., "day hiking", "backpacking", "camping", "trail running")
4. targetAudience: Who this guide is for (e.g., "beginners", "experienced hikers", "families", "ultralight enthusiasts")
5. difficulty: Difficulty level (e.g., "beginner", "intermediate", "advanced", "all levels")

Focus on extracting actual product categories that would have purchasable items in an outdoor gear catalog.
Only include equipment that is commonly sold in outdoor stores.

Return only valid JSON without any markdown formatting.`,
      temperature: 0.2,
    });

    return JSON.parse(text);
  } catch (error) {
    log.warning(`Could not analyze guide with AI, using fallback: ${error}`);
    
    // Fallback analysis based on common patterns
    const equipmentPatterns = [
      'boot', 'shoe', 'footwear', 'pack', 'backpack', 'bag', 'tent', 'shelter',
      'sleeping bag', 'pad', 'mat', 'stove', 'cookware', 'water', 'filter',
      'bottle', 'hydration', 'jacket', 'pants', 'shirt', 'hat', 'glove',
      'headlamp', 'flashlight', 'light', 'compass', 'gps', 'map', 'pole',
      'trekking pole', 'staff'
    ];
    
    const foundEquipment = equipmentPatterns.filter(pattern => 
      content.toLowerCase().includes(pattern)
    ).slice(0, 6);

    return {
      equipment: foundEquipment,
      categories: ['gear-essentials'],
      primaryActivity: 'hiking',
      targetAudience: 'general',
      difficulty: 'all levels'
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

  if (products.length === 0) {
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
  let recommendationsSection = `\n\n## 🛒 Recommended Products\n\n`;
  recommendationsSection += `*Based on the gear discussed in this guide, here are some top-rated products to consider for your ${analysis.primaryActivity} adventures:*\n\n`;

  for (const [category, categoryProducts] of Object.entries(productsByCategory)) {
    if (categoryProducts.length === 0) continue;
    
    recommendationsSection += `### ${category}\n\n`;
    
    for (const product of categoryProducts) {
      recommendationsSection += `**[${product.name}](${product.link})**`;
      
      if (product.price && product.price > 0) {
        recommendationsSection += ` - $${product.price}`;
      }
      
      if (product.brand) {
        recommendationsSection += ` *by ${product.brand}*`;
      }
      
      recommendationsSection += `\n`;
      
      if (product.description) {
        recommendationsSection += `${product.description}\n`;
      }
      
      recommendationsSection += `\n`;
    }
  }

  recommendationsSection += `---\n\n*Product recommendations are automatically generated using AI-powered analysis of this guide's content and our comprehensive outdoor gear database. Prices and availability may vary. [View all outdoor gear →](${API_BASE_URL}/catalog)*\n`;

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
    const analysis = await analyzeGuideContentWithAI(content, frontmatter.title || 'Guide');
    
    if (analysis.equipment.length === 0) {
      log.yellow('No equipment found in this guide, skipping...');
      return false;
    }

    log.blue(`Found equipment: ${analysis.equipment.join(', ')}`);
    log.blue(`Categories: ${analysis.categories.join(', ')}`);

    // Search for products for each piece of equipment
    const allProducts: ProductLink[] = [];
    
    for (const equipment of analysis.equipment.slice(0, 5)) { // Limit to top 5 to avoid too many products
      const products = await searchCatalogAPI(equipment);
      allProducts.push(...products);
      
      // Add a small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (allProducts.length === 0) {
      log.yellow('No products found for this guide');
      return false;
    }

    // Remove duplicates and sort by similarity score
    const uniqueProducts = Array.from(
      new Map(allProducts.map(p => [p.id, p])).values()
    ).sort((a, b) => b.similarity - a.similarity).slice(0, 6); // Limit to top 6 products

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
  log.blue('Starting PackRat AI-powered product link addition...');

  // Validate required environment variables
  if (!process.env.OPENAI_API_KEY) {
    log.red('OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  // Read the list of modified guide files
  if (!fs.existsSync(MODIFIED_GUIDES_FILE)) {
    log.yellow('No modified guides file found, processing all guides for testing...');
    
    // If no specific modified files, process a sample guide (for testing)
    const allGuides = fs.readdirSync(CONTENT_DIR)
      .filter(file => file.endsWith('.mdx'))
      .map(file => path.join(CONTENT_DIR, file));
    
    if (allGuides.length === 0) {
      log.yellow('No guide files found');
      return;
    }

    // Process just one guide for testing
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
      
      // Add a delay between processing guides to avoid rate limiting
      if (modifiedGuides.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } else {
      log.yellow(`File not found: ${guidePath}`);
    }
  }

  log.green(`Completed! Processed ${processedCount} guides with product recommendations`);
  
  // Clean up
  if (fs.existsSync(MODIFIED_GUIDES_FILE)) {
    fs.unlinkSync(MODIFIED_GUIDES_FILE);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    log.red(`Script failed: ${error}`);
    process.exit(1);
  });
}

export { processGuideFile, analyzeGuideContentWithAI, searchCatalogAPI };