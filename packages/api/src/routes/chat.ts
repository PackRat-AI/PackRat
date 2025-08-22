import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { reportedContent } from '@packrat/api/db/schema';
import {
  ChatRequestSchema,
  CreateReportRequestSchema,
  ErrorResponseSchema,
  ReportsResponseSchema,
  SuccessResponseSchema,
  UpdateReportStatusRequestSchema,
} from '@packrat/api/schemas/chat';
import type { Env } from '@packrat/api/types/env';
import type { Variables } from '@packrat/api/types/variables';
import { createAIProvider } from '@packrat/api/utils/ai/provider';
import { createTools } from '@packrat/api/utils/ai/tools';
import { getEnv } from '@packrat/api/utils/env-validation';
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import { eq } from 'drizzle-orm';
import { DEFAULT_MODELS } from '../utils/ai/models';
import { getSchemaInfo } from '../utils/DbUtils';

const chatRoutes = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

const chatRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Chat'],
  summary: 'Chat with AI assistant',
  description: 'Send messages to the PackRat AI assistant for hiking and outdoor gear advice',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ChatRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Streaming AI response',
      content: {
        'text/plain': {
          schema: z.string().openapi({
            description: 'Streaming text response from the AI',
          }),
        },
      },
    },
    400: {
      description: 'Bad request - Invalid message format',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

chatRoutes.openapi(chatRoute, async (c) => {
  const auth = c.get('user');

  let body: {
    messages?: UIMessage[] | undefined;
    contextType?: string;
    itemId?: string;
    packId?: string;
    location?: string;
  } = {};

  try {
    body = await c.req.json();
    const { messages, contextType, itemId, packId, location } = body;

    const tools = createTools(c, auth.userId);

    const schemaInfo = await getSchemaInfo(c);

    // Build context-aware system prompt
    let systemPrompt = `
      You are PackRat AI, a helpful assistant for hikers and outdoor enthusiasts.
      You help users manage their hiking packs and gear efficiently using ultralight principles.
            
      Guidelines:
      - Focus on ultralight hiking principles when appropriate
      - For beginners, emphasize safety and comfort over weight savings
      - Always consider weather conditions in your recommendations
      - Suggest multi-purpose items to reduce pack weight
      - Be concise but helpful in your responses
      - Use tools proactively to provide accurate, up-to-date information

      Schema Info for SQL Tool:
      ${schemaInfo}

      Context:
      - User id is ${auth.userId}`;

    // Add context-specific information
    if (contextType === 'pack' && packId) {
      systemPrompt += `\n- You are currently helping with a pack with ID: ${packId}.`;
    } else if (contextType === 'item' && itemId) {
      systemPrompt += `\n- You are currently helping with an item with ID: ${itemId}.`;
    }

    if (location) {
      systemPrompt += `\n- The current location of the user is: ${location}.`;
    }

    const { AI_PROVIDER, OPENAI_API_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_GATEWAY_ID, AI } =
      getEnv(c);

    // Create AI provider based on configuration
    const aiProvider = createAIProvider({
      openAiApiKey: OPENAI_API_KEY,
      provider: AI_PROVIDER,
      cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID,
      cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID,
      cloudflareAiBinding: AI,
    });

    if (!aiProvider) {
      return c.json({ error: 'AI provider not configured' }, 500);
    }

    // Stream the AI response
    const result = streamText({
      model: aiProvider(DEFAULT_MODELS.OPENAI_CHAT),
      system: systemPrompt,
      messages: convertToModelMessages(messages || []),
      tools,
      maxOutputTokens: 1000,
      temperature: 0.7,
      stopWhen: stepCountIs(5),
      onError: ({ error }) => {
        console.error('streaming error', error);
        c.get('sentry').setTag('location', 'chat/streamText');
        c.get('sentry').setContext('params', {
          body,
          openAiApiKey: !!OPENAI_API_KEY,
          aiProvider: AI_PROVIDER || 'openai',
        });
        c.get('sentry').captureException(error);
      },
    });

    // Get the response with proper headers
    const response = result.toUIMessageStreamResponse();

    // Add CORS headers for streaming when using Cloudflare Gateway
    if (CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_AI_GATEWAY_ID) {
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    }

    return response;
  } catch (error) {
    const { OPENAI_API_KEY, AI_PROVIDER } = getEnv(c);
    c.get('sentry').setContext('chat', {
      body,
      openAiApiKey: !!OPENAI_API_KEY,
      aiProvider: AI_PROVIDER,
    });

    throw error;
  }
});

const createReportRoute = createRoute({
  method: 'post',
  path: '/reports',
  tags: ['Chat'],
  summary: 'Report AI content',
  description: 'Report inappropriate or problematic AI responses for review',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateReportRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Report submitted successfully',
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

chatRoutes.openapi(createReportRoute, async (c) => {
  const auth = c.get('user');

  const db = createDb(c);

  const { userQuery, aiResponse, reason, userComment } = await c.req.json();

  // Insert the reported content into the database
  await db.insert(reportedContent).values({
    userId: auth.userId,
    userQuery,
    aiResponse,
    reason,
    userComment,
  });

  return c.json({ success: true }, 200);
});

// Get all reported content (admin only) - separate endpoint
const getReportsRoute = createRoute({
  method: 'get',
  path: '/reports',
  tags: ['Chat'],
  summary: 'Get reported content (Admin)',
  description: 'Retrieve all reported AI content for admin review',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'List of reported content',
      content: {
        'application/json': {
          schema: ReportsResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - Admin access required',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

chatRoutes.openapi(getReportsRoute, async (c) => {
  const auth = c.get('user');

  const db = createDb(c);

  // Check if user is admin
  const isAdmin = auth.role === 'ADMIN';
  if (!isAdmin) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const reportedItems = await db.query.reportedContent.findMany({
    orderBy: (reportedContent, { desc }) => [desc(reportedContent.createdAt)],
    with: {
      user: true,
    },
  });

  return c.json({ reportedItems }, 200);
});

// Update reported content status (admin only)
const updateReportRoute = createRoute({
  method: 'patch',
  path: '/reports/{id}',
  tags: ['Chat'],
  summary: 'Update report status (Admin)',
  description: 'Update the status of a reported content item (admin only)',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({
        example: '123',
        description: 'The ID of the report to update',
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateReportStatusRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Report status updated successfully',
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - Admin access required',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Report not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

chatRoutes.openapi(updateReportRoute, async (c) => {
  const auth = c.get('user');

  const db = createDb(c);

  // Check if user is admin
  const isAdmin = auth.role === 'ADMIN';
  if (!isAdmin) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const id = Number.parseInt(c.req.param('id'));
  const { status } = await c.req.json();

  await db
    .update(reportedContent)
    .set({
      status,
      reviewed: true,
      reviewedBy: auth.userId,
      reviewedAt: new Date(),
    })
    .where(eq(reportedContent.id, id));

  return c.json({ success: true }, 200);
});

export { chatRoutes };
