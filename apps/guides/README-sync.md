# Guides R2 Sync

This directory contains scripts and workflows for synchronizing guides content to Cloudflare R2 storage.

## Overview

The sync system automatically uploads guide content from the repository to the R2 bucket whenever changes are made to the guides content on the main branch.

## Components

### GitHub Action Workflow
- **File**: `.github/workflows/sync-guides-r2.yml`
- **Trigger**: Push to main branch with changes to `apps/guides/content/posts/**`
- **Manual Trigger**: Workflow dispatch with optional force sync

### Sync Script
- **File**: `apps/guides/scripts/sync-to-r2.ts`
- **Purpose**: Uploads MDX guide files to R2 bucket with metadata
- **Command**: `bun run sync-to-r2`

## Configuration

### Required Environment Variables
The following secrets must be configured in the GitHub repository:

- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
- `R2_ACCESS_KEY_ID`: R2 access key ID
- `R2_SECRET_ACCESS_KEY`: R2 secret access key
- `PACKRAT_GUIDES_BUCKET_R2_BUCKET_NAME`: Name of the R2 bucket for guides

### Workflow Features

1. **Incremental Sync**: Only uploads files that have changed (unless force sync is used)
2. **Metadata Preservation**: Extracts frontmatter data and stores as R2 object metadata
3. **Error Handling**: Provides detailed logging and exits with appropriate codes
4. **Manual Override**: Supports force sync to upload all files regardless of modification time

## Usage

### Automatic Sync
The workflow automatically runs when:
- Changes are pushed to the main branch
- Files in `apps/guides/content/posts/` are modified
- The workflow file itself is updated

### Manual Sync
To manually trigger a sync:
1. Go to Actions tab in GitHub
2. Select "Sync Guides to R2 Bucket" workflow
3. Click "Run workflow"
4. Optionally check "Force sync all guides" to upload all files

### Local Development
To run the sync script locally:

```bash
cd apps/guides

# Set required environment variables
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export R2_ACCESS_KEY_ID="your-access-key"
export R2_SECRET_ACCESS_KEY="your-secret-key"
export PACKRAT_GUIDES_BUCKET_R2_BUCKET_NAME="your-bucket-name"

# Run sync
bun run sync-to-r2

# Force sync all files
FORCE_SYNC=true bun run sync-to-r2
```

## File Processing

The sync script:
1. Scans all `.mdx` and `.md` files in `content/posts/`
2. Parses frontmatter metadata using gray-matter
3. Uploads files to R2 with:
   - Content-Type: `text/markdown`
   - Cache-Control: `public, max-age=3600`
   - Custom metadata from frontmatter (title, description, categories, etc.)

## Integration with API

The uploaded guides are consumed by the PackRat API through:
- `packages/api/src/routes/guides/getGuidesRoute.ts`
- `packages/api/src/services/r2-bucket.ts`

The API automatically reads guides from the R2 bucket and serves them through the `/api/guides` endpoints.