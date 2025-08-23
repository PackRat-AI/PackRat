# @ax-llm/ax Integration

This document describes the integration of @ax-llm/ax into the PackRat API to dramatically improve AI performance.

## Overview

@ax-llm/ax is a high-performance library for working with LLMs that provides enhanced features over standard AI SDK implementations:

- **Better Performance**: Advanced caching, retries, and rate limiting
- **Enhanced Streaming**: Improved streaming capabilities for real-time interactions
- **Robust Error Handling**: Better error recovery and timeout management
- **Optimization Features**: Built-in optimization for common LLM patterns
- **Observability**: Enhanced monitoring and debugging capabilities

## Configuration

### Environment Variables

Add the following environment variable to enable Ax features:

```bash
AI_PROVIDER=ax-openai  # Use 'ax-openai' instead of 'openai' for enhanced features
```

### Provider Options

The AI provider now supports three modes:

1. **openai** - Standard OpenAI SDK (existing behavior)
2. **cloudflare-workers-ai** - Cloudflare Workers AI (future support)
3. **ax-openai** - Enhanced OpenAI with @ax-llm/ax features ⭐ **NEW**

## Enhanced Features

### 1. Chat Streaming (Enhanced)

Chat responses now benefit from:
- **Retry Logic**: Automatic retries for failed requests (3 retries max)
- **Optimized Timeouts**: 30-second timeout optimized for chat interactions
- **Better Error Recovery**: Graceful handling of network issues

### 2. Pack Generation (Enhanced)

Pack generation operations are optimized with:
- **Extended Timeouts**: 60-second timeout for complex generation tasks
- **Retry Mechanisms**: Automatic retries for generation failures
- **Performance Optimization**: Better handling of complex object generation

### 3. Search Operations (Enhanced)

Search and RAG operations benefit from:
- **Fast Timeouts**: 15-second timeout for quick responses
- **Efficient Retries**: 2 retries optimized for search patterns
- **Better Caching**: Improved response caching (when available)

## Implementation Details

### AI Provider Factory

The `createAIProvider()` function now supports enhanced configuration:

```typescript
const aiProvider = createAIProvider({
  openAiApiKey: OPENAI_API_KEY,
  provider: 'ax-openai',  // Enhanced mode
  cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID,
  cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID,
  
  // Ax-specific options (when provider is 'ax-openai')
  enableRetries: true,
  maxRetries: 3,
  timeout: 30000,
  enableCaching: true,  // When available
});
```

### Configuration Presets

Pre-configured optimization presets are available:

- **AX_CHAT_CONFIG**: Optimized for real-time chat (30s timeout, 3 retries)
- **AX_PACK_GENERATION_CONFIG**: Optimized for generation tasks (60s timeout, 3 retries) 
- **AX_SEARCH_CONFIG**: Optimized for search operations (15s timeout, 2 retries)
- **AX_EMBEDDING_CONFIG**: Optimized for embedding operations (30s timeout, 2 retries)

## Usage Examples

### Chat Route
```typescript
// Automatically uses optimized chat configuration when AI_PROVIDER=ax-openai
const axConfig = AI_PROVIDER === 'ax-openai' ? getAxConfig('chat') : {};
const aiProvider = createAIProvider({
  openAiApiKey: OPENAI_API_KEY,
  provider: AI_PROVIDER,
  cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID,
  cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID,
  cloudflareAiBinding: AI,
  ...axConfig,
});
```

### Pack Service
```typescript
// Uses pack-generation optimized configuration
const axConfig = env.AI_PROVIDER === 'ax-openai' ? getAxConfig('pack-generation') : {};
const aiProvider = createAIProvider({
  openAiApiKey: env.OPENAI_API_KEY,
  provider: env.AI_PROVIDER,
  // ... other config
  ...axConfig,
});
```

## Performance Benefits

When `AI_PROVIDER=ax-openai` is enabled, you can expect:

1. **Improved Reliability**: Automatic retries reduce failed requests
2. **Better Timeouts**: Operation-specific timeouts prevent hanging requests
3. **Enhanced Streaming**: More reliable real-time chat streaming
4. **Optimized Generation**: Better performance for complex pack generation
5. **Graceful Degradation**: Better error handling and recovery

## Migration Guide

### For Existing Deployments

1. Update environment variable:
   ```bash
   # Before
   AI_PROVIDER=openai
   
   # After (to enable Ax features)
   AI_PROVIDER=ax-openai
   ```

2. Deploy the updated code

3. Monitor performance improvements in logs and metrics

### Backward Compatibility

- Setting `AI_PROVIDER=openai` maintains existing behavior
- All existing API endpoints work unchanged
- No breaking changes to client implementations

## Dependencies Added

- `@ax-llm/ax@^14.0.16` - Core Ax library
- `@ax-llm/ax-ai-sdk-provider@^14.0.16` - AI SDK compatibility layer

## Files Modified

- `packages/api/src/utils/ai/provider.ts` - Enhanced AI provider factory
- `packages/api/src/utils/ai/ax-config.ts` - Ax configuration presets ⭐ **NEW**
- `packages/api/src/utils/env-validation.ts` - Added ax-openai provider option
- `packages/api/src/routes/chat.ts` - Enhanced chat streaming
- `packages/api/src/services/packService.ts` - Enhanced pack generation
- `packages/api/package.json` - Added Ax dependencies

## Testing

The integration maintains full compatibility with the existing AI SDK, so all existing tests should pass. The Ax provider implements the same AI SDK interface with enhanced performance characteristics.

## Monitoring

When using `AI_PROVIDER=ax-openai`, monitor for:
- Reduced error rates in AI operations
- Improved response times for pack generation
- More reliable chat streaming
- Better handling of timeout scenarios