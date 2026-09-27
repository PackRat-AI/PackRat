import { z } from 'zod';

export const AddWatchedLocationRequestSchema = z.object({
  weatherLocationId: z.number().int(),
  locationName: z.string().min(1),
  region: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  lat: z.number(),
  lon: z.number(),
});

export const WatchedLocationSchema = z.object({
  id: z.string(),
  weatherLocationId: z.number(),
  locationName: z.string(),
  region: z.string().nullable(),
  country: z.string().nullable(),
  lat: z.number(),
  lon: z.number(),
  createdAt: z.string(),
});

export type AddWatchedLocationRequest = z.infer<typeof AddWatchedLocationRequestSchema>;
export type WatchedLocation = z.infer<typeof WatchedLocationSchema>;

export const RegisterDeviceTokenRequestSchema = z.object({
  platform: z.enum(['ios', 'android']),
  deviceToken: z.string().min(1),
});

export type RegisterDeviceTokenRequest = z.infer<typeof RegisterDeviceTokenRequestSchema>;
