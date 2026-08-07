import { createDb } from '@packrat/api/db';
import { authPlugin } from '@packrat/api/middleware/auth';
import { createAIProvider } from '@packrat/api/utils/ai/provider';
import { createTools } from '@packrat/api/utils/ai/tools';
import { getEnv } from '@packrat/api/utils/env-validation';
import { apiAddBreadcrumb, captureApiException } from '@packrat/api/utils/sentry';
import { reportedContent } from '@packrat/db/schema';
import {
  ChatRequestSchema,
  CreateReportRequestSchema,
  UpdateReportStatusRequestSchema,
} from '@packrat/schemas/chat';
import type { UIMessage } from 'ai';
import { eq } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';
import { DEFAULT_MODELS } from '../utils/ai/models';
import { getSchemaInfo } from '../utils/DbUtils';

const isE2EStubOpenAiKey = (openAiApiKey: string | undefined) =>
  openAiApiKey === 'sk-test' || openAiApiKey?.startsWith('sk-e2e-stub-') === true;

function e2eChatStreamResponse() {
  const text =
    'For this e2e pack, three essential items are a shelter, a sleep system, and water treatment.';
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'text-start', id: 'e2e-chat-response' })}\n\n`,
        ),
      );
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'text-delta', id: 'e2e-chat-response', delta: text })}\n\n`,
        ),
      );
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'text-end', id: 'e2e-chat-response' })}\n\n`,
        ),
      );
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

export const chatRoutes = new Elysia({ prefix: '/chat' })
  .model({
    'chat.ChatRequest': ChatRequestSchema,
    'chat.CreateReportRequest': CreateReportRequestSchema,
    'chat.UpdateReportStatusRequest': UpdateReportStatusRequestSchema,
  })
  .use(authPlugin)

  // Chat streaming
  .post(
    '/',
    async ({ body, user, request }) => {
      const typedBody = body as {
        messages?: UIMessage[] | undefined;
        contextType?: string;
        itemId?: string;
        packId?: string;
        location?: string;
        date: string;
        weightUnit?: 'kg' | 'lb';
        temperatureUnit?: 'C' | 'F';
        speedUnit?: 'kmh' | 'mph';
      };

      const {
        messages,
        contextType,
        itemId,
        packId,
        location,
        date,
        weightUnit,
        temperatureUnit,
        speedUnit,
      } = typedBody;

      const schemaInfo = await getSchemaInfo();

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
      - User id is ${user.userId}
      - Current date is ${date}
      - User's preferred weight unit is ${weightUnit ?? 'kg'} (always display weights in this unit)
      - User's preferred temperature unit is °${temperatureUnit ?? 'C'} (always display temperatures in this unit)
      - User's preferred wind/distance unit is ${speedUnit === 'mph' ? 'mph / miles' : 'km/h / km'} (always display wind speed and distances in this unit)`;

      if (contextType === 'pack' && packId) {
        systemPrompt += `\n- You are currently helping with a pack with ID: ${packId}. Use the getPackDetails tool to fetch its contents.`;
      } else if (contextType === 'item' && itemId) {
        systemPrompt += `\n- You are currently helping with an item with ID: ${itemId}. Use the getPackItemDetails tool to fetch its details.`;
      }

      if (location) {
        systemPrompt += `\n- The current location of the user is: ${location}.`;
      }

      const {
        AI_PROVIDER,
        OPENAI_API_KEY,
        CLOUDFLARE_ACCOUNT_ID,
        CLOUDFLARE_AI_GATEWAY_ID,
        CLOUDFLARE_API_TOKEN,
        AI,
        TOKEN_RATE_LIMITER,
      } = getEnv();

      if (TOKEN_RATE_LIMITER) {
        const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
        const rateLimitKey = `chat:${user.userId}:${ip}`;
        const { success } = await TOKEN_RATE_LIMITER.limit({ key: rateLimitKey });
        if (!success) {
          return status(429, { error: 'Too many chat requests, please try again shortly.' });
        }
      }

      if (isE2EStubOpenAiKey(OPENAI_API_KEY)) {
        return e2eChatStreamResponse();
      }

      const tools = await createTools(user.userId);
      const aiProvider = createAIProvider({
        openAiApiKey: OPENAI_API_KEY,
        provider: AI_PROVIDER,
        cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID,
        cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID,
        cloudflareApiToken: CLOUDFLARE_API_TOKEN,
        cloudflareAiBinding: AI,
      });

      if (!aiProvider) {
        captureApiException({
          error: new Error('AI provider not configured'),
          operation: 'chat.stream',
          userId: user.userId,
          tags: { ai_provider: AI_PROVIDER },
          extra: { httpStatus: 500, errorCode: 'AI_PROVIDER_NOT_CONFIGURED' },
        });
        return status(500, { error: 'AI provider not configured' });
      }

      apiAddBreadcrumb({
        category: 'ai.chat',
        message: 'Starting AI chat stream',
        level: 'info',
        data: {
          userId: user.userId,
          contextType,
          packId,
          itemId,
          messageCount: messages?.length ?? 0,
        },
      });

      const { convertToModelMessages, stepCountIs, streamText } = await import('ai');
      const result = streamText({
        model: aiProvider(DEFAULT_MODELS.OPENAI_CHAT),
        system: systemPrompt,
        messages: await convertToModelMessages(messages || []),
        tools,
        maxOutputTokens: 1000,
        temperature: 0.7,
        stopWhen: stepCountIs(5),
        onError: ({ error }) => {
          captureApiException({
            error: error,
            operation: 'chat.stream.onError',
            userId: user.userId,
            tags: { ai_provider: AI_PROVIDER, context_type: contextType ?? 'none' },
            extra: { packId, itemId, messageCount: messages?.length ?? 0 },
          });
        },
      });

      const response = result.toUIMessageStreamResponse();

      if (CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_AI_GATEWAY_ID) {
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      }

      return response;
    },
    {
      body: 'chat.ChatRequest',
      isAuthenticated: true,
      detail: { tags: ['Chat'], summary: 'Chat with AI assistant', security: [{ bearerAuth: [] }] },
    },
  )

  // Create report
  .post(
    '/reports',
    async ({ body, user }) => {
      const db = createDb();
      const { userQuery, aiResponse, reason, userComment } = body;

      await db.tag('chat.createReport').insert(reportedContent).values({
        userId: user.userId,
        userQuery,
        aiResponse,
        reason,
        userComment,
      });

      return { success: true };
    },
    {
      body: 'chat.CreateReportRequest',
      isAuthenticated: true,
      detail: { tags: ['Chat'], summary: 'Report AI content', security: [{ bearerAuth: [] }] },
    },
  )

  // Get reports (admin)
  .get(
    '/reports',
    async ({ user }) => {
      const db = createDb();

      if (user.role !== 'ADMIN') {
        return status(403, { error: 'Unauthorized' });
      }

      const reportedItems = await db.tag('chat.getReports').query.reportedContent.findMany({
        orderBy: (rc, { desc }) => [desc(rc.createdAt)],
        with: { user: true },
      });

      return {
        reportedItems: reportedItems.map((item) => ({
          ...item,
          updatedAt: item.createdAt,
        })),
      };
    },
    {
      isAuthenticated: true,
      detail: {
        tags: ['Chat'],
        summary: 'Get reported content (Admin)',
        security: [{ bearerAuth: [] }],
      },
    },
  )

  // Update report status (admin)
  .patch(
    '/reports/:id',
    async ({ params, body, user }) => {
      const db = createDb();

      if (user.role !== 'ADMIN') {
        return status(403, { error: 'Unauthorized' });
      }

      const id = Number.parseInt(params.id, 10);
      const { status: reportStatus } = body;

      await db
        .tag('chat.updateReportStatus')
        .update(reportedContent)
        .set({
          status: reportStatus,
          reviewed: true,
          reviewedBy: user.userId,
          reviewedAt: new Date(),
        })
        .where(eq(reportedContent.id, id));

      return { success: true };
    },
    {
      params: z.object({ id: z.string() }),
      body: 'chat.UpdateReportStatusRequest',
      isAuthenticated: true,
      detail: {
        tags: ['Chat'],
        summary: 'Update report status (Admin)',
        security: [{ bearerAuth: [] }],
      },
    },
  );
