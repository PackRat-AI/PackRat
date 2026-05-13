import {
  getLandingOgImageElement,
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_SIZE,
} from 'landing-app/lib/og-image';
import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(getLandingOgImageElement(), { ...size });
}
