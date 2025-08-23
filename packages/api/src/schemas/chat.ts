import { z } from '@hono/zod-openapi';

export const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({
      description: 'Error message',
    }),
    code: z.string().optional().openapi({
      description: 'Error code for programmatic handling',
    }),
  })
  .openapi('ErrorResponse');

export const SuccessResponseSchema = z
  .object({
    success: z.boolean().openapi({
      example: true,
      description: 'Indicates if the operation was successful',
    }),
  })
  .openapi('SuccessResponse');

export const ChatMessageSchema = z
  .object({
    role: z.enum(['user', 'assistant', 'system']).openapi({
      example: 'user',
      description: 'The role of the message sender',
    }),
    content: z.string().openapi({
      example: 'What should I pack for a 3-day hiking trip?',
      description: 'The message content',
    }),
  })
  .openapi('ChatMessage');

export const ChatRequestSchema = z
  .object({
    messages: z.array(ChatMessageSchema).openapi({
      description: 'Array of chat messages',
    }),
    contextType: z.string().optional().openapi({
      example: 'pack',
      description: 'Type of context for the chat (e.g., pack, item)',
    }),
    itemId: z.string().optional().openapi({
      example: 'item_123456',
      description: 'ID of the item being discussed',
    }),
    packId: z.string().optional().openapi({
      example: 'pack_123456',
      description: 'ID of the pack being discussed',
    }),
    location: z.string().optional().openapi({
      example: 'Mount Washington, New Hampshire',
      description: 'Current location context for the user',
    }),
  })
  .openapi('ChatRequest');

export const ReportedContentUserSchema = z
  .object({
    id: z.number().openapi({
      example: 123,
      description: 'User ID',
    }),
    email: z.string().email().openapi({
      example: 'user@example.com',
      description: 'User email',
    }),
    firstName: z.string().nullable().openapi({
      example: 'John',
      description: 'User first name',
    }),
    lastName: z.string().nullable().openapi({
      example: 'Doe',
      description: 'User last name',
    }),
  })
  .openapi('ReportedContentUser');

export const ReportedContentSchema = z
  .object({
    id: z.number().openapi({
      example: 1,
      description: 'Report ID',
    }),
    userId: z.number().openapi({
      example: 123,
      description: 'ID of user who reported',
    }),
    userQuery: z.string().openapi({
      example: 'What should I pack for winter hiking?',
      description: 'The original user query',
    }),
    aiResponse: z.string().openapi({
      example: 'Here are some essential items for winter hiking...',
      description: 'The AI response that was reported',
    }),
    reason: z.string().openapi({
      example: 'inappropriate_content',
      description: 'Reason for reporting',
    }),
    userComment: z.string().nullable().openapi({
      example: 'The response contained unsafe advice.',
      description: 'Additional user comment about the report',
    }),
    status: z.string().openapi({
      example: 'pending',
      description: 'Status of the report',
    }),
    reviewed: z.boolean().nullable().openapi({
      example: false,
      description: 'Whether the report has been reviewed',
    }),
    reviewedBy: z.number().nullable().openapi({
      example: 456,
      description: 'ID of admin who reviewed',
    }),
    reviewedAt: z.string().datetime().nullable().openapi({
      example: '2024-01-01T12:00:00Z',
      description: 'When the report was reviewed',
    }),
    createdAt: z.string().datetime().openapi({
      example: '2024-01-01T10:00:00Z',
      description: 'When the report was created',
    }),
    updatedAt: z.string().datetime().openapi({
      example: '2024-01-01T10:00:00Z',
      description: 'When the report was last updated',
    }),
    user: ReportedContentUserSchema,
  })
  .openapi('ReportedContent');

export const CreateReportRequestSchema = z
  .object({
    userQuery: z.string().openapi({
      example: 'What should I pack for winter hiking?',
      description: 'The original user query',
    }),
    aiResponse: z.string().openapi({
      example: 'Here are some essential items for winter hiking...',
      description: 'The AI response being reported',
    }),
    reason: z.string().openapi({
      example: 'inappropriate_content',
      description: 'Reason for reporting the content',
    }),
    userComment: z.string().optional().openapi({
      example: 'The response contained unsafe advice.',
      description: 'Additional user comment about the report',
    }),
  })
  .openapi('CreateReportRequest');

export const ReportsResponseSchema = z
  .object({
    reportedItems: z.array(ReportedContentSchema),
  })
  .openapi('ReportsResponse');

export const UpdateReportStatusRequestSchema = z
  .object({
    status: z.string().openapi({
      example: 'resolved',
      description: 'New status for the report',
    }),
  })
  .openapi('UpdateReportStatusRequest');
