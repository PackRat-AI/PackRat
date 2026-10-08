import { z } from 'zod';

/** E.164, e.g. +14155550123 — what SMS delivery needs. */
const PhoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Use international format, e.g. +14155550123');

export const EmergencyContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateEmergencyContactRequestSchema = z
  .object({
    id: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(100),
    phone: PhoneSchema.nullable().optional(),
    email: z.string().email().nullable().optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((c) => Boolean(c.phone || c.email), {
    message: 'A contact needs a phone number or an email address',
    path: ['phone'],
  });

export const UpdateEmergencyContactRequestSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phone: PhoneSchema.nullable().optional(),
  email: z.string().email().nullable().optional(),
  isDefault: z.boolean().optional(),
});

export const IdentifyingGearItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  note: z.string().trim().max(60).nullable().optional(),
});

export const StartSafetyCheckInRequestSchema = z.object({
  /** Client-generated so a start queued offline is idempotent on retry. */
  id: z.string().min(1).max(64),
  contactIds: z.array(z.string()).min(1).max(10),
  expectedReturnAt: z.string().datetime(),
  graceMinutes: z
    .number()
    .int()
    .min(30)
    .max(24 * 60)
    .default(120),
  identifyingGear: z.array(IdentifyingGearItemSchema).max(20).default([]),
  trackingEnabled: z.boolean().default(false),
  /** When the user tapped Start Trip, which can precede upload by hours. */
  startedAt: z.string().datetime(),
  timeZone: z.string().min(1).max(64),
});

export const ExtendSafetyCheckInRequestSchema = z.object({
  expectedReturnAt: z.string().datetime(),
});

export const EndSafetyCheckInRequestSchema = z.object({
  /** When the user tapped I'm Safe / ended it on the phone. */
  endedAt: z.string().datetime(),
});

export const SafetyCheckInLocationInputSchema = z.object({
  /** Client-generated so a re-uploaded offline batch doesn't duplicate. */
  id: z.string().min(1).max(64),
  kind: z.enum(['check_in', 'track']),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().nonnegative().nullable().optional(),
  placeName: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(280).nullable().optional(),
  recordedAt: z.string().datetime(),
});

export const UploadSafetyCheckInLocationsRequestSchema = z.object({
  locations: z.array(SafetyCheckInLocationInputSchema).min(1).max(500),
});

export const SafetyCheckInLocationSchema = z.object({
  id: z.string(),
  kind: z.enum(['check_in', 'track']),
  latitude: z.number(),
  longitude: z.number(),
  placeName: z.string().nullable(),
  note: z.string().nullable(),
  recordedAt: z.string(),
});

export const SafetyCheckInSchema = z.object({
  id: z.string(),
  tripId: z.string(),
  status: z.enum(['active', 'safe', 'cancelled']),
  shareUrl: z.string(),
  expectedReturnAt: z.string(),
  graceMinutes: z.number(),
  /** expectedReturnAt + grace: when contacts get the overdue alert. */
  overdueAt: z.string(),
  identifyingGear: z.array(IdentifyingGearItemSchema),
  trackingEnabled: z.boolean(),
  startedAt: z.string(),
  overdueAlertSentAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  contacts: z.array(z.object({ contactId: z.string().nullable(), name: z.string() })),
  lastLocation: SafetyCheckInLocationSchema.nullable(),
});

export type EmergencyContact = z.infer<typeof EmergencyContactSchema>;
export type CreateEmergencyContactRequest = z.infer<typeof CreateEmergencyContactRequestSchema>;
export type UpdateEmergencyContactRequest = z.infer<typeof UpdateEmergencyContactRequestSchema>;
export type IdentifyingGearItem = z.infer<typeof IdentifyingGearItemSchema>;
export type StartSafetyCheckInRequest = z.infer<typeof StartSafetyCheckInRequestSchema>;
export type SafetyCheckInLocationInput = z.infer<typeof SafetyCheckInLocationInputSchema>;
export type SafetyCheckIn = z.infer<typeof SafetyCheckInSchema>;
