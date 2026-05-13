export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_IMAGE_CONTENT_TYPE = 'image/png' as const;

interface WebsiteSocialMetadataInput {
  siteUrl: string;
  siteName: string;
  title: string;
  description: string;
  imagePath: string;
  twitterHandle: string;
  locale?: string;
}

export function buildWebsiteSocialMetadata({
  siteUrl,
  siteName,
  title,
  description,
  imagePath,
  twitterHandle,
  locale = 'en_US',
}: WebsiteSocialMetadataInput) {
  return {
    metadataBase: new URL(siteUrl),
    openGraph: {
      type: 'website' as const,
      locale,
      url: siteUrl,
      siteName,
      title,
      description,
      images: [
        { url: imagePath, width: OG_IMAGE_SIZE.width, height: OG_IMAGE_SIZE.height, alt: title },
      ],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      creator: twitterHandle,
      images: [imagePath],
    },
  };
}
