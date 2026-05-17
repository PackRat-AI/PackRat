import { ImageResponse } from 'next/og';
import {
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
  getTrailsOgImageElement,
} from 'trails-app/lib/og-image';

export const dynamic = 'force-static';
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(getTrailsOgImageElement(), { ...size });
}
