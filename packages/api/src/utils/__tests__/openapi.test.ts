import { describe, expect, it, vi } from 'vitest';
import { configureOpenAPI } from '../openapi';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockApp = {
  openAPIRegistry: {
    registerComponent: vi.fn(),
  },
  doc: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('openapi', () => {
  describe('configureOpenAPI', () => {
    it('registers security schemes', () => {
      configureOpenAPI(mockApp as any);

      expect(mockApp.openAPIRegistry.registerComponent).toHaveBeenCalledWith(
        'securitySchemes',
        'bearerAuth',
        expect.objectContaining({
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        }),
      );

      expect(mockApp.openAPIRegistry.registerComponent).toHaveBeenCalledWith(
        'securitySchemes',
        'refreshToken',
        expect.objectContaining({
          type: 'apiKey',
          in: 'header',
          name: 'X-Refresh-Token',
        }),
      );
    });

    it('registers common schema components', () => {
      configureOpenAPI(mockApp as any);

      expect(mockApp.openAPIRegistry.registerComponent).toHaveBeenCalledWith(
        'schemas',
        'Error',
        expect.any(Object),
      );

      expect(mockApp.openAPIRegistry.registerComponent).toHaveBeenCalledWith(
        'schemas',
        'Success',
        expect.any(Object),
      );

      expect(mockApp.openAPIRegistry.registerComponent).toHaveBeenCalledWith(
        'schemas',
        'PaginationParams',
        expect.any(Object),
      );

      expect(mockApp.openAPIRegistry.registerComponent).toHaveBeenCalledWith(
        'schemas',
        'PaginationResponse',
        expect.any(Object),
      );
    });

    it('registers common response components', () => {
      configureOpenAPI(mockApp as any);

      expect(mockApp.openAPIRegistry.registerComponent).toHaveBeenCalledWith(
        'responses',
        'UnauthorizedError',
        expect.any(Object),
      );

      expect(mockApp.openAPIRegistry.registerComponent).toHaveBeenCalledWith(
        'responses',
        'ForbiddenError',
        expect.any(Object),
      );

      expect(mockApp.openAPIRegistry.registerComponent).toHaveBeenCalledWith(
        'responses',
        'NotFoundError',
        expect.any(Object),
      );

      expect(mockApp.openAPIRegistry.registerComponent).toHaveBeenCalledWith(
        'responses',
        'ValidationError',
        expect.any(Object),
      );

      expect(mockApp.openAPIRegistry.registerComponent).toHaveBeenCalledWith(
        'responses',
        'ServerError',
        expect.any(Object),
      );
    });

    it('configures OpenAPI documentation', () => {
      configureOpenAPI(mockApp as any);

      expect(mockApp.doc).toHaveBeenCalledWith(
        '/doc',
        expect.objectContaining({
          openapi: '3.1.0',
          info: expect.objectContaining({
            title: 'PackRat API',
            version: '1.0.0',
          }),
        }),
      );
    });

    it('returns the configured app', () => {
      const result = configureOpenAPI(mockApp as any);
      expect(result).toBe(mockApp);
    });
  });
});
