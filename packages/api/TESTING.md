# API Testing Strategy

This document outlines the comprehensive testing strategy for the PackRat API, covering both unit tests and integration tests.

## Overview

The API uses a **dual testing approach**:

1. **Unit Tests** (`src/**/__tests__/`) - Fast, isolated tests for business logic
2. **Integration Tests** (`test/`) - Full end-to-end tests using Cloudflare Workers pool

## Unit Testing

### Configuration

Unit tests use `vitest.unit.config.ts` and run in a standard Node.js environment with mocked dependencies.

**Run unit tests:**
```bash
bun test:unit
```

**Run with coverage:**
```bash
bun test:unit:coverage
```

### What We Unit Test

We focus unit tests on **pure business logic** that can be effectively tested in isolation:

#### ✅ **Middleware** (3 files)
- `middleware/auth.ts` - JWT and API key authentication
- `middleware/apiKeyAuth.ts` - API key validation
- `middleware/adminMiddleware.ts` - Admin authorization

**Why:** Critical security components with clear input/output behavior.

#### ✅ **Utilities** (5 files)
- `utils/itemCalculations.ts` - Pack/item weight and quantity calculations
- `utils/auth.ts` - Password hashing, token generation, validation
- `utils/csv-utils.ts` - CSV parsing and normalization
- `utils/embeddingHelper.ts` - Text preparation for embeddings
- `utils/openapi.ts` - OpenAPI configuration

**Why:** Pure functions with no external dependencies or simple mockable dependencies.

#### ✅ **Services** (5 files)
- `services/packService.ts` - Pack business logic
- `services/catalogService.ts` - Catalog operations
- `services/weatherService.ts` - Weather API integration
- `services/embeddingService.ts` - AI embedding generation
- `services/imageDetectionService.ts` - Image analysis

**Why:** Core business services where mocking external APIs is straightforward.

### What We DON'T Unit Test (and why)

We **exclude** the following from unit test coverage because they're better tested via integration tests:

#### ❌ **Type Definitions & Schemas** (`src/types/**`, `src/schemas/**`, `src/db/**`)
- Pure TypeScript types and Zod schemas
- No runtime logic to test
- Type safety enforced at compile time

#### ❌ **Route Handlers** (`src/routes/**`)
- Thin wrappers that orchestrate services
- Heavy dependency on Hono context and database
- **Already comprehensively covered by integration tests** in `/test` directory:
  - `test/packs.test.ts`
  - `test/catalog.test.ts`
  - `test/auth.test.ts`
  - `test/guides.test.ts`
  - etc.

#### ❌ **Database Utilities** (`src/utils/DbUtils.ts`)
- Requires live database connection
- Complex Drizzle ORM mocking not worthwhile
- Better tested via integration tests

#### ❌ **External Service Utilities**
- `utils/email.ts` (Resend API)
- `utils/getPresignedUrl.ts` (AWS S3)
- `utils/env-validation.ts` (Environment-dependent)
- `services/r2-bucket.ts` (Cloudflare R2)
- `services/packItemService.ts` (Heavy DB dependency)

**Why:** Mocking these external services in unit tests provides little value compared to integration tests.

#### ❌ **ETL & Complex Services**
- `services/etl/**` - Batch processing pipelines
- `services/aiService.ts` - Complex AI orchestration
- `utils/ai/**` - AI provider configuration

**Why:** Complex state management and orchestration better validated end-to-end.

#### ❌ **Infrastructure**
- `src/containers/**` - Cloudflare Container lifecycle
- `src/index.ts` - Application entry point

**Why:** No business logic to test.

## Integration Testing

Integration tests use the **Cloudflare Workers pool** (`@cloudflare/vitest-pool-workers`) and run against a **live PostgreSQL database** in Docker.

**Run integration tests:**
```bash
bun test
```

### What Integration Tests Cover

Integration tests provide **end-to-end validation** of:

- ✅ **All API routes** with real HTTP requests
- ✅ **Database operations** with real PostgreSQL
- ✅ **Authentication flows** (signup, login, refresh)
- ✅ **Authorization** (admin, user permissions)
- ✅ **External API integrations** (weather, AI, etc.)
- ✅ **Complex workflows** (pack creation, catalog ETL, etc.)

### Key Integration Test Files

- `test/auth.test.ts` - Authentication and user management
- `test/packs.test.ts` - Pack CRUD and operations
- `test/catalog.test.ts` - Catalog item management
- `test/guides.test.ts` - Guide content and search
- `test/weather.test.ts` - Weather API integration
- `test/upload.test.ts` - File upload workflows
- `test/admin.test.ts` - Admin operations
- `test/chat.test.ts` - AI chat functionality

## Coverage Goals

### Unit Test Coverage
- **Target:** 70% coverage of **business logic files only**
- **Measured on:** Middleware, utils (non-external), core services
- **Excluded:** Types, schemas, routes, DB, ETL, external services

### Overall Test Coverage
- **Unit + Integration combined:** Near 100% of actual runtime code paths
- **Critical paths:** 100% coverage via integration tests
- **Business logic:** 70%+ coverage via unit tests

## Testing Principles

1. ✅ **Unit test pure business logic** - Fast feedback on core functionality
2. ✅ **Integration test orchestration** - Validate real-world behavior
3. ✅ **Don't duplicate coverage** - Use the right tool for each layer
4. ✅ **Mock external dependencies** - Keep unit tests fast and reliable
5. ✅ **Use real services in integration tests** - Catch integration issues

## Adding New Tests

### When to Write a Unit Test
- Pure function with clear inputs/outputs
- Business logic that doesn't require database
- Service method that can be easily mocked

### When to Write an Integration Test
- New API endpoint
- Database query or transaction
- Multi-step workflow
- External API integration

### Running Tests Locally

```bash
# Unit tests only (fast)
bun test:unit

# Unit tests with coverage
bun test:unit:coverage

# Integration tests (requires Docker + DB)
bun test

# Type checking
bun check-types
```

## CI/CD

All tests run automatically on:
- Pull requests
- Pushes to `main` and `dev` branches

**CI Workflows:**
- `.github/workflows/check-types.yml` - TypeScript validation
- `.github/workflows/api-tests.yml` - Integration tests
- Unit tests run as part of the overall test suite

## Maintenance

- **Keep unit tests focused** - Test one thing at a time
- **Update mocks when APIs change** - Keep mocks in sync with reality
- **Review coverage reports** - Identify gaps in critical paths
- **Refactor tests with code** - Tests are first-class code

---

**Last Updated:** 2026-04-04  
**Maintained by:** PackRat Engineering Team
