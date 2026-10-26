import { z } from 'zod';

/** The fields PackRat reads from a Firebase service-account key file. */
export const FcmServiceAccountSchema = z.object({
  project_id: z.string().min(1),
  client_email: z.string().min(1),
  private_key: z.string().min(1),
});

export type FcmServiceAccount = z.infer<typeof FcmServiceAccountSchema>;

/** Google's OAuth reply when a service-account JWT is exchanged for an access token. */
export const GoogleAccessTokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
});
