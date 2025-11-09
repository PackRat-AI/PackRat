import { vi } from 'vitest';

// Mock the AI SDK modules
export function setupAIMocks() {
  // Mock the streamText function from 'ai'
  vi.mock('ai', async () => {
    const actual = await vi.importActual<typeof import('ai')>('ai');
    return {
      ...actual,
      streamText: vi.fn(({ system, messages }) => {
        // Create a mock stream response
        const mockResponse = `Mock AI response for: ${messages?.[messages.length - 1]?.content || 'query'}`;
        
        return {
          toUIMessageStreamResponse: () => {
            // Return a mock Response with streaming
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
              start(controller) {
                // Send mock streaming data
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content: mockResponse })}\n\n`));
                controller.close();
              },
            });

            return new Response(stream, {
              headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
              },
            });
          },
        };
      }),
    };
  });

  // Mock the AI provider module
  vi.mock('@packrat/api/utils/ai/provider', () => ({
    createAIProvider: vi.fn(() => {
      // Return a mock provider function
      return (modelId: string) => ({
        modelId,
        provider: 'openai',
      });
    }),
    extractCloudflareLogId: vi.fn(() => null),
  }));

  // Mock the AI tools module
  vi.mock('@packrat/api/utils/ai/tools', () => ({
    createTools: vi.fn(() => ({})),
  }));

  // Mock schema info utility
  vi.mock('@packrat/api/utils/DbUtils', () => ({
    getSchemaInfo: vi.fn(async () => 'Mock schema info'),
  }));
}

// Reset all AI mocks
export function resetAIMocks() {
  vi.clearAllMocks();
}
