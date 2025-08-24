import { clientEnvs } from 'expo-app/env/clientEnvs';

export function buildPackTemplateItemImageUrl(image?: string | null): string | null {
  if (!image) return null;
  
  // If image is already a full URL, return it
  if (image.startsWith('http')) {
    return image;
  }
  
  // Otherwise, build URL using R2 base URL
  const baseUrl = clientEnvs.EXPO_PUBLIC_R2_PUBLIC_URL;
  return `${baseUrl}/${image}`;
}