#!/usr/bin/env bun

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Simple frontmatter parser since gray-matter might not be available in global scope
// Note: This is a basic parser that only handles simple key: value pairs
// For complex YAML structures (arrays, objects, multiline), use a proper YAML parser
function parseFrontmatter(content: string): { data: Record<string, string>; content: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { data: {}, content };
  }

  const frontmatterText = match[1];
  const bodyContent = match[2];

  // Simple YAML parsing for basic key: value pairs
  const data: Record<string, string> = {};
  const lines = frontmatterText.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();

      // Remove quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      data[key] = value;
    }
  }

  return { data, content: bodyContent };
}

interface ExtractedGear {
  name: string;
  category: string;
  description?: string;
  keywords: string[];
}

interface ProductMatch {
  id: number;
  name: string;
  brand: string | null;
  productUrl: string;
  price: number | null;
  similarity: number;
}

interface ExtractionResult {
  guideFile: string;
  guideTitle: string;
  extractedGears: ExtractedGear[];
  productMatches: Array<{
    extractedGear: ExtractedGear;
    catalogMatches: ProductMatch[];
  }>;
  processedAt: string;
}

async function extractProductsFromGuide(
  filePath: string,
  apiUrl?: string,
): Promise<ExtractionResult> {
  console.log(`Processing guide: ${filePath}`);

  // Read and parse the guide file
  const fileContent = await readFile(filePath, 'utf-8');
  const { data: frontmatter, content } = parseFrontmatter(fileContent);

  const guideTitle = frontmatter.title || 'Untitled Guide';
  console.log(`Guide title: ${guideTitle}`);

  const payload = {
    guideContent: content,
    guideTitle: guideTitle,
  };

  try {
    // Try to call the API endpoint if available
    if (apiUrl) {
      console.log(`Calling API endpoint: ${apiUrl}/api/guides/extract-products`);

      const response = await fetch(`${apiUrl}/api/guides/extract-products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.PACKRAT_API_KEY || ''}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        return {
          guideFile: filePath,
          guideTitle: guideTitle,
          extractedGears: result.extractionResult.gears,
          productMatches: result.productMatches,
          processedAt: result.processedAt,
        };
      } else {
        console.warn(
          `API call failed with status ${response.status}, falling back to local processing`,
        );
      }
    }
  } catch (error) {
    console.warn(`API call failed: ${error}, falling back to local processing`);
  }

  // Fallback: Simple keyword-based extraction (for when API is not available)
  console.log('Using fallback extraction method');

  const gearKeywords = {
    shelter: ['tent', 'tarp', 'bivy', 'shelter', 'footprint', 'rainfly'],
    sleeping: ['sleeping bag', 'pad', 'pillow', 'quilt', 'liner'],
    clothing: ['jacket', 'pants', 'base layer', 'rain gear', 'boots', 'socks', 'hat', 'gloves'],
    backpack: ['backpack', 'pack', 'daypack', 'hiking pack', 'rucksack'],
    cooking: ['stove', 'pot', 'pan', 'cup', 'spork', 'cookware', 'fuel'],
    water: ['water filter', 'purifier', 'bottle', 'hydration', 'bladder'],
    navigation: ['map', 'compass', 'gps', 'altimeter'],
    safety: ['first aid', 'whistle', 'headlamp', 'flashlight', 'emergency'],
    hiking: ['trekking poles', 'hiking poles', 'boots', 'shoes', 'gaiters'],
  };

  const extractedGears: ExtractedGear[] = [];
  const lowerContent = content.toLowerCase();

  // Simple keyword matching
  for (const [category, keywords] of Object.entries(gearKeywords)) {
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword)) {
        extractedGears.push({
          name: keyword,
          category: category,
          description: `${keyword} mentioned in guide`,
          keywords: [keyword, category],
        });
      }
    }
  }

  // Remove duplicates
  const uniqueGears = extractedGears.filter(
    (gear, index, self) =>
      index === self.findIndex((g) => g.name === gear.name && g.category === gear.category),
  );

  return {
    guideFile: filePath,
    guideTitle: guideTitle,
    extractedGears: uniqueGears,
    productMatches: [], // No product matching in fallback mode
    processedAt: new Date().toISOString(),
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: extract-guide-products.ts <guide-file-1> [guide-file-2] ...');
    process.exit(1);
  }

  const apiUrl = process.env.PACKRAT_API_URL || process.env.EXPO_PUBLIC_API_URL;
  const results: ExtractionResult[] = [];

  console.log(`Processing ${args.length} guide file(s)...`);
  if (apiUrl) {
    console.log(`Using API endpoint: ${apiUrl}`);
  } else {
    console.log('No API URL provided, using fallback extraction');
  }

  for (const filePath of args) {
    if (!existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      continue;
    }

    try {
      const result = await extractProductsFromGuide(filePath, apiUrl);
      results.push(result);

      console.log(`✅ Processed ${filePath}: Found ${result.extractedGears.length} gear items`);
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error);
    }
  }

  // Write results to output file
  const outputPath = join(process.cwd(), 'extracted_products.json');
  await writeFile(outputPath, JSON.stringify(results, null, 2));

  // Also create a summary log
  const logPath = join(process.cwd(), 'extracted_products.log');
  const logContent = results
    .map(
      (result) =>
        `Guide: ${result.guideTitle}\n` +
        `File: ${result.guideFile}\n` +
        `Gears found: ${result.extractedGears.length}\n` +
        `Processed at: ${result.processedAt}\n` +
        `---\n`,
    )
    .join('\n');

  await writeFile(logPath, logContent);

  console.log(`\n📄 Results written to:`);
  console.log(`  - ${outputPath}`);
  console.log(`  - ${logPath}`);

  console.log(`\n📊 Summary:`);
  console.log(`  - Processed files: ${results.length}`);
  console.log(
    `  - Total gears found: ${results.reduce((sum, r) => sum + r.extractedGears.length, 0)}`,
  );
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}
