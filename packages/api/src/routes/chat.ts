import { createOpenAI } from '@ai-sdk/openai';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { createDb } from '@packrat/api/db';
import { reportedContent } from '@packrat/api/db/schema';
import type { Env } from '@packrat/api/types/env';
import { createTools } from '@packrat/api/utils/ai/tools';
import { authenticateRequest, unauthorizedResponse } from '@packrat/api/utils/api-middleware';
import { streamText } from 'ai';
import { eq } from 'drizzle-orm';
import { env } from 'hono/adapter';

const chatRoutes = new OpenAPIHono();

const chatRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.any(),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Chat response',
    },
  },
});

chatRoutes.openapi(chatRoute, async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  let body: {
    messages?: any[];
    contextType?: string;
    itemId?: string;
    packId?: string;
    location?: string;
  } = {};

  try {
    body = await c.req.json();
    const { messages, contextType, itemId, packId, location } = body;

    const tools = createTools(c, auth.userId);

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
    `;

    // Add context-specific information
    if (contextType === 'pack' && packId) {
      systemPrompt += `\n\nContext: You are currently helping with a pack with ID: ${packId}.`;
    } else if (contextType === 'item' && itemId) {
      systemPrompt += `\n\nContext: You are currently helping with an item with ID: ${itemId}.`;
    }

    if (location) {
      systemPrompt += `\n\nContext: The current location of the user is: ${location}.`;
    }

    const { OPENAI_API_KEY } = env<Env>(c);

    const customOpenAI = createOpenAI({
      apiKey: OPENAI_API_KEY,
    });

    // Stream the AI response
    const result = streamText({
      model: customOpenAI('gpt-4o'),
      system: systemPrompt,
      messages,
      tools,
      maxTokens: 1000,
      temperature: 0.7,
      maxSteps: 5,
      onError: ({ error }) => {
        console.error('streaming error', error);
        c.get('sentry').setTag('location', 'chat/streamText');
        c.get('sentry').setContext('params', {
          body,
          openAiApiKey: !!OPENAI_API_KEY,
        });
        c.get('sentry').captureException(error);
      }
    });

    return result.toDataStreamResponse();
  } catch (error) {
    c.get('sentry').setContext('chat', {
      body,
      openAiApiKey: !!env<Env>(c).OPENAI_API_KEY,
    });

    throw error;
  }
});

chatRoutes.post('/reports', async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

  const db = createDb(c);

  const { messageId, userQuery, aiResponse, reason, userComment } =
    await c.req.json();

  // Insert the reported content into the database
  await db.insert(reportedContent).values({
    userId: auth.userId,
    userQuery,
    aiResponse,
    reason,
    userComment,
  });

  return c.json({ success: true });
});

// Get all reported content (admin only) - separate endpoint
chatRoutes.get('/reports', async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

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

  return c.json({ reportedItems });
});

// Update reported content status (admin only)
chatRoutes.patch('/reports/:id', async (c) => {
  const auth = await authenticateRequest(c);
  if (!auth) {
    return unauthorizedResponse();
  }

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

  return c.json({ success: true });
});

export { chatRoutes };
