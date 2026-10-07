import { SharedPostView } from 'landing-app/components/shared-post/shared-post-view';
import type { Metadata } from 'next';

/**
 * Static shell for shared-post links (`/p/{publicId}`). The Worker in
 * `worker/index.ts` serves this page for every such link, replacing the
 * metadata below with the post's own and embedding the post for the view.
 */
export const metadata: Metadata = {
  title: 'Shared post',
  robots: { index: false, follow: true },
};

export default function SharedPostPage() {
  return <SharedPostView />;
}
