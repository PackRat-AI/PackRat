import { z } from 'zod';

export const WildlifeIdentifyRequestSchema = z.object({
  image: z.string().describe('Uploaded image key in R2'),
});
