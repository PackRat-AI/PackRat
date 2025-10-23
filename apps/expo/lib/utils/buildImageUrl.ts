import { clientEnvs } from 'expo-app/env/clientEnvs';

export function buildImageUrl({ userId, image }: { userId: number; image: string }): string {
  const baseUrl = clientEnvs.EXPO_PUBLIC_R2_PUBLIC_URL;
  return `${baseUrl}/${userId}-${image}`;
}
