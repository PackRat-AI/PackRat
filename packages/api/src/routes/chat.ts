import { createDb } from '@packrat/api/db';
import { reportedContent } from '@packrat/api/db/schema';
import { authPlugin } from '@packrat/api/middleware/auth';
import {
  ChatRequestSchema,
  CreateReportRequestSchema,
  UpdateReportStatusRequestSchema,
} from '@packrat/api/schemas/chat';
import { createAIProvider } from '@packrat/api/utils/ai/provider';
import { createTools } from '@packrat/api/utils/ai/tools';
import { getEnv } from '@packrat/api/utils/env-validation';
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import { eq } from 'drizzle-orm';
import { Elysia, status } from 'elysia';
import { z } from 'zod';
import { DEFAULT_MODELS } from '../utils/ai/models';
import { getSchemaInfo } from '../utils/DbUtils';

export const chatRoutes = new Elysia({ prefix: '/chat' })
  .use(authPlugin)

  // Chat streaming
  .post(
    '/',
    async ({ body, user }) => {
      const typedBody = body as {
        messages?: UIMessage[] | undefined;
        contextType?: string;
        itemId?: string;
        packId?: string;
        location?: string;
        date: string;
      };

      const { messages, contextType, itemId, packId, location, date } = typedBody;

      const tools = createTools(user.userId);
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
      - Current date is ${date}`;

      if (contextType === 'pack' && packId) {
        systemPrompt += `\n- You are currently helping with a pack with ID: ${packId}.`;
      } else if (contextType === 'item' && itemId) {
        systemPrompt += `\n- You are currently helping with an item with ID: ${itemId}.`;
      }

      if (location) {
        systemPrompt += `\n- The current location of the user is: ${location}.`;
      }

      const { AI_PROVIDER, OPENAI_API_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_GATEWAY_ID, AI } =
        getEnv();

      const aiProvider = createAIProvider({
        openAiApiKey: OPENAI_API_KEY,
        provider: AI_PROVIDER,
        cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID,
        cloudflareGatewayId: CLOUDFLARE_AI_GATEWAY_ID,
        cloudflareAiBinding: AI,
      });

      if (!aiProvider) {
        return status(500, { error: 'AI provider not configured' });
      }

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
      body: ChatRequestSchema,
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

      await db.insert(reportedContent).values({
        userId: user.userId,
        userQuery,
        aiResponse,
        reason,
        userComment,
      });

      return { success: true };
    },
    {
      body: CreateReportRequestSchema,
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

      const reportedItems = await db.query.reportedContent.findMany({
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
      body: UpdateReportStatusRequestSchema,
      isAuthenticated: true,
      detail: {
        tags: ['Chat'],
        summary: 'Update report status (Admin)',
        security: [{ bearerAuth: [] }],
      },
    },
  );
