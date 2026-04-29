#!/usr/bin/env bun

import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { R2BucketService } from '../../../packages/api/src/services/r2-bucket';
import type { ValidatedEnv } from '../../../packages/api/src/utils/env-validation';

// Environment configuration for the sync script — parsed and validated at startup.
const SyncEnvSchema = z.object({
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  PACKRAT_GUIDES_BUCKET_R2_BUCKET_NAME: z.string().min(1),
  FORCE_SYNC: z.string().optional(),
});

type SyncEnv = z.infer<typeof SyncEnvSchema>;

const envResult = SyncEnvSchema.safeParse(process.env);
if (!envResult.success) {
  for (const issue of envResult.error.issues) {
    console.error(`❌ Missing required environment variable: ${issue.path.join('.')}`);
  }
  process.exit(1);
}

const env: SyncEnv = envResult.data;

const postsDirectory = path.join(process.cwd(), 'content/posts');
const forceSync = env.FORCE_SYNC === 'true';

console.log('🚀 Starting guides sync to R2 bucket...');
console.log(`📁 Posts directory: ${postsDirectory}`);
console.log(`🪣 Target bucket: ${env.PACKRAT_GUIDES_BUCKET_R2_BUCKET_NAME}`);
console.log(`🔄 Force sync: ${forceSync}`);

async function syncGuidesToR2() {
  try {
    // Initialize R2 bucket service
    // safe-cast: SyncEnv carries the S3/R2 credential subset that R2BucketService needs at runtime;
    // the remaining ValidatedEnv fields are not accessed by the guides-bucket code path.
    const bucket = new R2BucketService({
      env: env as unknown as ValidatedEnv, // safe-cast: SyncEnv carries the S3/R2 credentials R2BucketService needs
      bucketType: 'guides',
    });

    // Get list of existing objects in bucket (for comparison if not forcing sync)
    let existingObjects: Set<string> = new Set();
    if (!forceSync) {
      console.log('📋 Checking existing files in R2 bucket...');
      const list = await bucket.list();
      existingObjects = new Set(list.objects.map((obj) => obj.key));
      console.log(`📄 Found ${existingObjects.size} existing files in bucket`);
    }

    // Read all MDX files from posts directory
    if (!fs.existsSync(postsDirectory)) {
      console.error(`❌ Posts directory not found: ${postsDirectory}`);
      process.exit(1);
    }

    const files = fs
      .readdirSync(postsDirectory)
      .filter((file) => file.endsWith('.mdx') || file.endsWith('.md'));

    console.log(`📚 Found ${files.length} guide files to process`);

    let uploaded = 0;
    let skipped = 0;
    let errors = 0;

    for (const file of files) {
      const filePath = path.join(postsDirectory, file);
      const fileKey = file; // Use filename as key in R2

      try {
        // Check if we should skip this file (not forcing sync and file exists)
        if (!forceSync && existingObjects.has(fileKey)) {
          // Check if local file is newer than remote
          const stats = fs.statSync(filePath);
          const head = await bucket.head(fileKey);

          if (head && head.uploaded >= stats.mtime) {
            console.log(`⏭️  Skipping ${file} (already up to date)`);
            skipped++;
            continue;
          }
        }

        console.log(`📤 Uploading ${file}...`);

        // Read and parse file content
        const fileContent = fs.readFileSync(filePath, 'utf8');

        // Upload to R2 with metadata
        await bucket.put(fileKey, fileContent, {
          httpMetadata: {
            contentType: 'text/markdown',
            cacheControl: 'public, max-age=3600', // Cache for 1 hour
          },
        });

        console.log(`✅ Successfully uploaded ${file}`);
        uploaded++;
      } catch (error) {
        console.error(`❌ Error uploading ${file}:`, error);
        errors++;
      }
    }

    // Report results
    console.log('\n📊 Sync Summary:');
    console.log(`✅ Uploaded: ${uploaded} files`);
    console.log(`⏭️  Skipped: ${skipped} files`);
    console.log(`❌ Errors: ${errors} files`);
    console.log(`📁 Total processed: ${files.length} files`);

    if (errors > 0) {
      console.error('\n❌ Sync completed with errors');
      process.exit(1);
    } else {
      console.log('\n🎉 Sync completed successfully!');
    }
  } catch (error) {
    console.error('❌ Fatal error during sync:', error);
    process.exit(1);
  }
}

// Run the sync
syncGuidesToR2().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});
