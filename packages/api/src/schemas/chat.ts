import { z } from 'zod';

export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});

export const SuccessResponseSchema = z.object({
  success: z.boolean(),
});

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

export const ChatRequestSchema = z.any();
// .oRbject({
//   messages: z.array(ChatMessageSchema),
//   contextType: z.string().optional(),
//   itemId: z.string().optional(),
//   packId: z.string().optional(),
//   location: z.string().optional(),
// })
// ;

export const ReportedContentUserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
});

export const ReportedContentSchema = z.object({
  id: z.number(),
  userId: z.number(),
  userQuery: z.string(),
  aiResponse: z.string(),
  reason: z.string(),
  userComment: z.string().nullable(),
  status: z.string(),
  reviewed: z.boolean().nullable(),
  reviewedBy: z.number().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  user: ReportedContentUserSchema,
});

export const CreateReportRequestSchema = z.object({
  userQuery: z.string(),
  aiResponse: z.string(),
  reason: z.string(),
  userComment: z.string().optional(),
});

export const ReportsResponseSchema = z.object({
  reportedItems: z.array(ReportedContentSchema),
});

export const UpdateReportStatusRequestSchema = z.object({
  status: z.string(),
});
