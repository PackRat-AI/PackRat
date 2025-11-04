import { clientEnvs } from 'expo-app/env/clientEnvs';
import type { PackTemplateItem } from 'expo-app/features/pack-templates';
import type { PackItem } from 'expo-app/features/packs';

export function buildImageUrl({ userId, image }: PackTemplateItem | PackItem): string {
  const baseUrl = clientEnvs.EXPO_PUBLIC_R2_PUBLIC_URL;
  return `${baseUrl}/${userId}-${image}`;
}
