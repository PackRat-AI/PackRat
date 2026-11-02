import { Text } from '@packrat/ui/src/text';
import * as Sentry from '@sentry/react-native';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { File, Paths } from 'expo-file-system';
import { Image, type ImageLoadEventData } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Share, useWindowDimensions, View, type ViewInstance } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { Post } from '../types';
import { buildPostImageUrl } from '../utils';
import { displayName } from '../utils/mentions';
import { postShareUrl } from '../utils/share';

const appIcon = require('expo-app/assets/packrat-app-icon-gradient.png');

/** Longest edge of a shared photo: the same size posts are uploaded at. */
const MAX_SHARE_EDGE = 2048;

type Pending = { imageKey: string; size: { width: number; height: number } | null };

/**
 * Sends a post out through the Android share sheet — its link, or the current photo with a small
 * PackRat mark in the bottom corner. The marked photo is drawn off screen and captured only once
 * the user asks for it, so the share menu costs nothing to open.
 *
 * Render `renderer` once in the screen body.
 */
export function useSharePost({ onPhotoFailed }: { onPhotoFailed: () => void }) {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const [pending, setPending] = useState<Pending | null>(null);
  const markRef = useRef<ViewInstance>(null);

  const shareLink = async (post: Post) => {
    const url = postShareUrl(post);
    if (!url) return;
    const name = post.author ? displayName(post.author) : t('feed.shareSomeone');
    try {
      await Share.share({ message: `${t('feed.shareMessage', { name })} ${url}`, url });
    } catch (error) {
      Sentry.captureException(error, { tags: { feature: 'feed', action: 'shareLink' } });
    }
  };

  const sharePhoto = (imageKey: string) => setPending({ imageKey, size: null });

  const capture = async (size: { width: number; height: number }) => {
    try {
      const scale = Math.min(1, MAX_SHARE_EDGE / Math.max(size.width, size.height));
      const uri = await captureRef(markRef, {
        format: 'jpg',
        quality: 0.9,
        result: 'tmpfile',
        width: Math.round(size.width * scale),
        height: Math.round(size.height * scale),
      });
      const named = new File(Paths.cache, 'PackRat.jpg');
      await new File(uri).move(named, { overwrite: true });
      await Sharing.shareAsync(named.uri, { mimeType: 'image/jpeg' });
    } catch (error) {
      Sentry.captureException(error, { tags: { feature: 'feed', action: 'sharePhoto' } });
      onPhotoFailed();
    } finally {
      setPending(null);
    }
  };

  const onLoad = (event: ImageLoadEventData) => {
    const size = { width: event.source.width, height: event.source.height };
    setPending((current) => (current ? { ...current, size } : current));
    // Let the mark lay out over the loaded photo before capturing.
    requestAnimationFrame(() => requestAnimationFrame(() => capture(size)));
  };

  let renderer: React.ReactNode = null;
  if (pending) {
    const ratio = pending.size ? pending.size.width / pending.size.height : 1;
    const width = windowWidth;
    const height = width / ratio;
    // Scaled to the photo so the mark reads the same on any resolution.
    const mark = Math.max(width, height) * 0.034;
    renderer = (
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: -10_000, top: 0, width, height }}
        importantForAccessibility="no-hide-descendants"
      >
        <View ref={markRef} collapsable={false} style={{ width, height }}>
          <Image
            source={{ uri: buildPostImageUrl(pending.imageKey) }}
            style={{ width, height }}
            contentFit="cover"
            onLoad={onLoad}
            onError={() => {
              setPending(null);
              onPhotoFailed();
            }}
          />
          <View
            className="absolute flex-row items-center rounded-full bg-black/40"
            style={{
              right: mark * 0.6,
              bottom: mark * 0.6,
              gap: mark * 0.32,
              paddingLeft: mark * 0.28,
              paddingRight: mark * 0.45,
              paddingVertical: mark * 0.24,
            }}
          >
            <Image
              source={appIcon}
              style={{ width: mark, height: mark, borderRadius: mark * 0.24 }}
            />
            <Text
              style={{ fontSize: mark * 0.6, lineHeight: mark * 0.8 }}
              className="font-bold text-white"
            >
              PackRat
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return { shareLink, sharePhoto, isPreparingPhoto: pending !== null, renderer };
}
