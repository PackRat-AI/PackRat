import type { PackTemplateItem } from '@packrat/app/pack-templates';
import type { PackItem } from '@packrat/app/packs';
import { clientEnvs } from '@packrat/env/expo-client';

export function buildImageUrl({ userId, image }: PackTemplateItem | PackItem): string {
  const baseUrl = clientEnvs.EXPO_PUBLIC_R2_PUBLIC_URL;
  return `${baseUrl}/${userId}-${image}`;
}
