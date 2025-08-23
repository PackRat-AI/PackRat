# API Deployment Configuration

This document outlines the GitHub Actions workflows for automated deployment of the PackRat API to Cloudflare Workers.

## Workflows

### Production Deployment
- **Workflow**: `.github/workflows/api-deploy-prod.yml`
- **Trigger**: Push to `main` branch with changes in `packages/api/`
- **Environment**: `production`
- **Deployment**: Cloudflare Workers production environment

### Development Deployment
- **Workflow**: `.github/workflows/api-deploy-dev.yml`
- **Trigger**: Push to `development` branch with changes in `packages/api/`
- **Environment**: `development`
- **Deployment**: Cloudflare Workers development environment

## Required Secrets

### Production Environment (`production`)

#### Authentication & Deployment
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Workers:Edit permissions
- `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN` - GitHub PAT for private package access

#### Database
- `NEON_DATABASE_URL` - Production PostgreSQL connection string
- `NEON_DATABASE_URL_READONLY` - Production read-only PostgreSQL connection string

#### Authentication & Security
- `JWT_SECRET` - JWT signing secret
- `PASSWORD_RESET_SECRET` - Password reset token secret
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `ADMIN_USERNAME` - Admin username
- `ADMIN_PASSWORD` - Admin password
- `PACKRAT_API_KEY` - API key for internal services

#### External Services
- `SENTRY_DSN` - Sentry error tracking DSN
- `RESEND_API_KEY` - Resend email service API key
- `OPENAI_API_KEY` - OpenAI API key
- `PERPLEXITY_API_KEY` - Perplexity AI API key
- `OPENWEATHER_KEY` - OpenWeatherMap API key
- `WEATHER_API_KEY` - Weather service API key

#### Cloudflare Services
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID
- `CLOUDFLARE_AI_GATEWAY_ID` - Cloudflare AI Gateway ID
- `R2_ACCESS_KEY_ID` - Cloudflare R2 access key ID
- `R2_SECRET_ACCESS_KEY` - Cloudflare R2 secret access key

### Development Environment (`development`)
All production secrets with `_DEV` suffix:
- `CLOUDFLARE_API_TOKEN_DEV`
- `NEON_DATABASE_URL_DEV`
- `NEON_DATABASE_URL_READONLY_DEV`
- `JWT_SECRET_DEV`
- `PASSWORD_RESET_SECRET_DEV`
- `GOOGLE_CLIENT_ID_DEV`
- `ADMIN_USERNAME_DEV`
- `ADMIN_PASSWORD_DEV`
- `PACKRAT_API_KEY_DEV`
- `RESEND_API_KEY_DEV`
- `OPENAI_API_KEY_DEV`
- `PERPLEXITY_API_KEY_DEV`
- `OPENWEATHER_KEY_DEV`
- `WEATHER_API_KEY_DEV`
- `CLOUDFLARE_ACCOUNT_ID_DEV`
- `CLOUDFLARE_AI_GATEWAY_ID_DEV`
- `R2_ACCESS_KEY_ID_DEV`
- `R2_SECRET_ACCESS_KEY_DEV`

## Required Variables

### Production Environment
- `EMAIL_PROVIDER` - Email service provider (default: 'resend')
- `EMAIL_FROM` - From email address
- `AI_PROVIDER` - AI service provider (default: 'openai')
- `PACKRAT_BUCKET_R2_BUCKET_NAME` - R2 bucket name for main storage
- `PACKRAT_GUIDES_BUCKET_R2_BUCKET_NAME` - R2 bucket name for guides
- `PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME` - R2 bucket name for scrapy data
- `PACKRAT_GUIDES_RAG_NAME` - RAG service name for guides
- `PACKRAT_GUIDES_BASE_URL` - Base URL for guides service

### Development Environment
All production variables with `_DEV` suffix:
- `EMAIL_PROVIDER_DEV`
- `EMAIL_FROM_DEV`
- `AI_PROVIDER_DEV`
- `PACKRAT_BUCKET_R2_BUCKET_NAME_DEV`
- `PACKRAT_GUIDES_BUCKET_R2_BUCKET_NAME_DEV`
- `PACKRAT_SCRAPY_BUCKET_R2_BUCKET_NAME_DEV`
- `PACKRAT_GUIDES_RAG_NAME_DEV`
- `PACKRAT_GUIDES_BASE_URL_DEV`

## Setup Instructions

1. **Create GitHub Environments**:
   - Go to repository Settings → Environments
   - Create `production` environment
   - Create `development` environment

2. **Add Secrets**:
   - For each environment, add the required secrets listed above
   - Ensure proper secret naming (production vs development)

3. **Add Variables**:
   - For each environment, add the required variables listed above
   - Variables are non-sensitive configuration values

4. **Cloudflare Setup**:
   - Ensure Cloudflare Workers are properly configured
   - Verify R2 buckets exist and are accessible
   - Confirm AI Gateway and other services are enabled

## Security Notes

- Secrets are encrypted and only accessible during workflow execution
- Environment protection rules can be configured for production deployments
- Manual approval can be required for production deployments
- Deployment concurrency is controlled to prevent race conditions

## Troubleshooting

### Common Issues

1. **Environment Validation Fails**:
   - Check that all required secrets and variables are set
   - Verify secret names match exactly (case-sensitive)
   - Ensure GitHub PAT has `read:packages` scope

2. **Deployment Fails**:
   - Verify Cloudflare API token has correct permissions
   - Check that Cloudflare account ID is correct
   - Ensure wrangler.jsonc configuration is valid

3. **Package Authentication Fails**:
   - Verify `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN` is set
   - Ensure GitHub PAT has `read:packages` scope
   - Check that PAT is not expired

### Manual Deployment

If automated deployment fails, you can deploy manually:

```bash
# Production
cd packages/api
bun run deploy

# Development
cd packages/api
bun run deploy:dev
```

## Monitoring

- Monitor deployment status in GitHub Actions
- Check Cloudflare Workers logs for runtime issues
- Monitor Sentry for application errors