import { createDbClient } from '../db';
import { catalogItems } from '../db/schema';
import { like, sql } from 'drizzle-orm';
import type { Env } from '../types/env';

/**
 * Detects potential image mismatches in catalog items
 * Looks for items where the name suggests one type but the image suggests another
 */
export async function detectImageMismatches(env: Env): Promise<
  Array<{
    id: number;
    name: string;
    categories: string[];
    imageUrl: string;
    issue: string;
  }>
> {
  const db = createDbClient(env);
  const mismatches: Array<{
    id: number;
    name: string;
    categories: string[];
    imageUrl: string;
    issue: string;
  }> = [];

  // Define suspicious patterns
  const suspiciousPatterns = [
    {
      namePattern: /backpack|pack/i,
      imagePattern: /jacket|coat/i,
      issue: 'Backpack item shows jacket image',
    },
    {
      namePattern: /jacket|coat/i,
      imagePattern: /backpack|pack/i,
      issue: 'Jacket item shows backpack image',
    },
    {
      namePattern: /tent/i,
      imagePattern: /sleeping.?bag/i,
      issue: 'Tent item shows sleeping bag image',
    },
    {
      namePattern: /sleeping.?bag/i,
      imagePattern: /tent/i,
      issue: 'Sleeping bag item shows tent image',
    },
    {
      namePattern: /shoe|boot|footwear/i,
      imagePattern: /shirt|pant|clothing/i,
      issue: 'Footwear item shows clothing image',
    },
    {
      namePattern: /shirt|pant/i,
      imagePattern: /shoe|boot/i,
      issue: 'Clothing item shows footwear image',
    },
  ];

  // Get all catalog items with images
  const items = await db
    .select({
      id: catalogItems.id,
      name: catalogItems.name,
      categories: catalogItems.categories,
      images: catalogItems.images,
    })
    .from(catalogItems)
    .where(sql`${catalogItems.images} IS NOT NULL AND array_length(${catalogItems.images}, 1) > 0`);

  for (const item of items) {
    const imageUrl = item.images?.[0] || '';
    const imageLower = imageUrl.toLowerCase();

    for (const pattern of suspiciousPatterns) {
      if (pattern.namePattern.test(item.name) && pattern.imagePattern.test(imageLower)) {
        mismatches.push({
          id: item.id,
          name: item.name,
          categories: item.categories || [],
          imageUrl,
          issue: pattern.issue,
        });
        break; // Only report first match per item
      }
    }
  }

  return mismatches;
}

/**
 * Updates a catalog item's images
 */
export async function updateCatalogItemImages(
  env: Env,
  itemId: number,
  newImages: string[],
): Promise<void> {
  const db = createDbClient(env);

  await db
    .update(catalogItems)
    .set({
      images: newImages,
      updatedAt: new Date(),
    })
    .where(sql`${catalogItems.id} = ${itemId}`);
}

/**
 * Run diagnostic and output results
 */
export async function runImageMismatchDiagnostic(env: Env): Promise<void> {
  console.log('🔍 Scanning catalog for image mismatches...\n');

  const mismatches = await detectImageMismatches(env);

  if (mismatches.length === 0) {
    console.log('✅ No image mismatches detected');
    return;
  }

  console.log(`⚠️  Found ${mismatches.length} potential mismatches:\n`);

  for (const mismatch of mismatches) {
    console.log(`Item #${mismatch.id}: ${mismatch.name}`);
    console.log(`  Categories: ${mismatch.categories.join(', ')}`);
    console.log(`  Issue: ${mismatch.issue}`);
    console.log(`  Image URL: ${mismatch.imageUrl}`);
    console.log('');
  }
}
