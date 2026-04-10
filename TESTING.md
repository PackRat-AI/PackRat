# Unit Testing Guide for PackRat

This document outlines testing standards and patterns used in the PackRat codebase.

## Overview

PackRat uses **Vitest** as its primary testing framework across both API and Expo layers. This guide demonstrates the patterns established in our unit test suite.

---

## Testing Infrastructure

### API Layer (packages/api)

**Configuration Files:**
- `vitest.config.ts` - Full integration tests with PostgreSQL + Cloudflare Workers
- `vitest.unit.config.ts` - Pure unit tests with mocked dependencies (recommended for most unit tests)

**Commands:**
```bash
# From packages/api
bun test          # Full integration tests (requires Docker)
bun test:unit     # Unit tests only (no database)
bun test:unit:coverage  # Unit tests with coverage report

# From monorepo root
bun test:api:unit
```

**Coverage Configuration:**
- **Provider:** v8
- **Reports:** text, lcov, html
- **Directory:** `packages/api/coverage/unit/`
- **Target:** 80%+ coverage for critical paths

### Expo Layer (apps/expo)

**Configuration File:**
- `vitest.config.ts` - Node environment for pure utility functions

**Commands:**
```bash
# From apps/expo
bun test              # Run utility tests
bun test:coverage     # With coverage report

# From monorepo root
bun test:expo
```

**Coverage Configuration:**
- **Provider:** v8
- **Reports:** text, lcov, html
- **Directory:** `apps/expo/coverage/unit/`
- **Target:** 75%+ coverage for utility functions

**Note:** Currently limited to pure utility functions. React Native hooks and components require additional setup (e.g., @testing-library/react-native).

---

## Test Patterns

### Pattern 1: Service Tests with Mocked Dependencies

**Example:** `/packages/api/src/services/__tests__/catalogService.test.ts`

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogService } from '../catalogService';
import * as embeddingService from '@packrat/api/services/embeddingService';

// Module-level mocks (hoisted)
vi.mock('@packrat/api/db', () => ({
  createDb: vi.fn(),
  createDbClient: vi.fn(),
}));

vi.mock('@packrat/api/services/embeddingService', () => ({
  generateEmbedding: vi.fn(),
  generateManyEmbeddings: vi.fn(),
}));

// Test suite
describe('CatalogService', () => {
  let service: CatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CatalogService(makeEnv(), false);
  });

  describe('vectorSearch', () => {
    beforeEach(() => {
      vi.mocked(embeddingService.generateEmbedding)
        .mockResolvedValue(new Array(1536).fill(0.1));
    });

    it('returns empty result for empty query string', async () => {
      const result = await service.vectorSearch('', 10, 0);

      expect(result).toEqual({
        items: [],
        total: 0,
        limit: 10,
        offset: 0,
        nextOffset: 10,
      });
      expect(embeddingService.generateEmbedding).not.toHaveBeenCalled();
    });
  });
});
```

**Key Points:**
- Use `vi.mock()` for module-level mocks (these are hoisted)
- Import mocked modules for type-safe access (e.g., `import * as embeddingService`)
- Use `vi.mocked()` for type-safe mock assertions
- Clear mocks in `beforeEach()` for test isolation

### Pattern 2: API Service Tests with Fetch Mocking

**Example:** `/packages/api/src/services/__tests__/weatherService.test.ts`

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WeatherService } from '../weatherService';

describe('WeatherService', () => {
  let service: WeatherService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = makeMockContext();
    service = new WeatherService(mockContext);

    // Mock global fetch
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  describe('getWeatherForLocation', () => {
    it('returns formatted weather data for valid location', async () => {
      const mockResponse = {
        main: { temp: 72.5, humidity: 65 },
        weather: [{ main: 'Clear' }],
        wind: { speed: 8.3 },
      };
      
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getWeatherForLocation('San Francisco');

      expect(result.temperature).toBe(73); // Rounded
      expect(result.conditions).toBe('Clear');
    });
  });
});
```

**Key Points:**
- Mock `global.fetch` in `beforeEach()` for fresh state
- Use `mockResolvedValue` for successful responses
- Test both success and error paths
- Verify API was called with correct parameters

### Pattern 3: Pure Utility Function Tests

**Example:** `/apps/expo/features/packs/utils/__tests__/convertToGrams.test.ts`

```typescript
import { describe, expect, it } from 'vitest';
import { convertToGrams } from '../convertToGrams';

describe('convertToGrams', () => {
  describe('metric conversions', () => {
    it('returns same value for grams', () => {
      expect(convertToGrams(100, 'g')).toBe(100);
      expect(convertToGrams(0, 'g')).toBe(0);
      expect(convertToGrams(1, 'g')).toBe(1);
    });

    it('converts kilograms to grams correctly', () => {
      expect(convertToGrams(1, 'kg')).toBe(1000);
      expect(convertToGrams(2.5, 'kg')).toBe(2500);
    });
  });

  describe('edge cases', () => {
    it('handles zero weight', () => {
      expect(convertToGrams(0, 'kg')).toBe(0);
    });

    it('returns original value for unknown units', () => {
      expect(convertToGrams(100, 'invalid')).toBe(100);
    });
  });
});
```

**Key Points:**
- No mocking needed for pure functions
- Group related tests with nested `describe()` blocks
- Test edge cases (zero, negative, invalid input)
- Use `toBe()` for exact values, `toBeCloseTo()` for floating point
- Test real-world scenarios to ensure practical correctness

---

## Best Practices

### 1. Test Organization

```typescript
describe('ServiceName', () => {
  // Setup
  let service: ServiceName;

  beforeEach(() => {
    // Reset mocks and create fresh instances
  });

  describe('methodName', () => {
    // Group related tests

    describe('when condition', () => {
      // Nested context-specific tests
    });
  });
});
```

### 2. Mock Isolation

```typescript
beforeEach(() => {
  vi.clearAllMocks();  // Reset all mock state
  // Re-create service instances
  // Set default mock return values
});
```

### 3. Input Validation Tests

Always test:
- ✅ Valid inputs (happy path)
- ✅ Invalid inputs (error paths)
- ✅ Edge cases (empty, null, undefined, zero, negative)
- ✅ Boundary conditions (min/max values)

### 4. Floating Point Comparisons

```typescript
// ❌ Don't use exact equality for floats
expect(convertToGrams(1, 'oz')).toBe(28.3495);

// ✅ Use toBeCloseTo() with appropriate precision
expect(convertToGrams(1, 'oz')).toBeCloseTo(28.3495, 4);
```

### 5. Async Testing

```typescript
// Test async functions
it('handles async operation', async () => {
  const result = await service.fetchData();
  expect(result).toBeDefined();
});

// Test error handling
it('throws on invalid input', async () => {
  await expect(service.process(null)).rejects.toThrow('Invalid input');
});
```

### 6. Mock Configuration Patterns

```typescript
// Default behavior for all tests in describe block
beforeEach(() => {
  mockFunction.mockResolvedValue(defaultValue);
});

// Override for specific test
it('handles special case', async () => {
  mockFunction.mockResolvedValueOnce(specialValue);
  // ...
});
```

---

## Coverage Guidelines

### What to Test (Priority Order)

1. **Critical Business Logic**
   - Payment processing
   - User authentication
   - Data validation
   - Core algorithms

2. **Public APIs**
   - All exported functions
   - All route handlers
   - Service methods

3. **Edge Cases**
   - Null/undefined handling
   - Empty collections
   - Boundary values
   - Invalid inputs

4. **Error Paths**
   - Exception handling
   - Validation errors
   - Network failures
   - Database errors

### What NOT to Test

- Third-party library internals
- Simple getters/setters with no logic
- Generated code
- Configuration files
- Type definitions

---

## Running Tests in CI

### API Tests (GitHub Actions)

```yaml
- name: Run API Unit Tests
  run: |
    cd packages/api
    bun test:unit --coverage
```

### Expo Tests (GitHub Actions)

```yaml
- name: Run Expo Tests
  run: |
    cd apps/expo
    bun test --coverage
```

### Coverage Reports

Coverage reports are generated in:
- API: `packages/api/coverage/unit/`
- Expo: `apps/expo/coverage/unit/`

Open `index.html` to view detailed coverage reports locally.

---

## Troubleshooting

### "Cannot access before initialization" Error

**Problem:** Trying to use a variable declared after `vi.mock()`

**Solution:** Import the mocked module after the mock declaration

```typescript
// ❌ Won't work - hoisting issue
const mockFn = vi.fn();
vi.mock('./module', () => ({ fn: mockFn }));

// ✅ Works - import after mock
vi.mock('./module', () => ({ fn: vi.fn() }));
import * as module from './module';
// Use vi.mocked(module.fn) in tests
```

### Mock Not Resetting Between Tests

**Problem:** Mock state persists across tests

**Solution:** Always call `vi.clearAllMocks()` in `beforeEach()`

```typescript
beforeEach(() => {
  vi.clearAllMocks();  // Resets all mock history and implementations
});
```

### Floating Point Precision Errors

**Problem:** `expect(0.1 + 0.2).toBe(0.3)` fails due to floating point arithmetic

**Solution:** Use `toBeCloseTo()` with appropriate precision

```typescript
expect(0.1 + 0.2).toBeCloseTo(0.3, 10);  // 10 decimal places
```

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Mocking in Vitest](https://vitest.dev/guide/mocking.html)
- [Coverage Configuration](https://vitest.dev/guide/coverage.html)

---

## Test Statistics (Current)

### API Layer
- **Test Files:** 8
- **Tests:** 101 passing
- **Coverage Target:** 80%+

### Expo Layer
- **Test Files:** 8  
- **Tests:** 93 passing (excluding pre-existing failures)
- **Coverage Target:** 75%+

### Recent Additions
- ✅ `CatalogService` - Vector search, batch operations, input validation
- ✅ `WeatherService` - API calls, error handling, data transformations
- ✅ `convertToGrams` - Unit conversions, edge cases, real-world scenarios
- ✅ `convertFromGrams` - Reverse conversions, precision handling

---

## Contributing

When adding new features:

1. **Write tests first** (TDD approach) or alongside implementation
2. **Aim for 80%+ coverage** for new code
3. **Test all code paths** including error cases
4. **Use existing patterns** from this guide
5. **Update this document** if introducing new patterns

When fixing bugs:

1. **Write a failing test** that reproduces the bug
2. **Fix the bug** until the test passes
3. **Verify** no regressions with full test suite

---

*Last Updated: 2026-04-01*
