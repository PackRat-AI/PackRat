import { clientEnvs } from 'expo-app/env/clientEnvs';
import type { PackItem } from 'expo-app/features/packs';

export function buildPackItemImageUrl(item: PackItem): string {
  const baseUrl = clientEnvs.EXPO_PUBLIC_R2_PUBLIC_URL;
  return `${baseUrl}/${item.userId}-${item.image}`;
}
