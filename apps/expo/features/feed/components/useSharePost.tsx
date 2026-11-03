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

type Pending = {
  imageKey: string;
  fileName: string;
  size: { width: number; height: number } | null;
};

const UNSAFE_FILE_CHARACTERS = /[\\/:*?"<>|\n\r\t]+/g;
const RUNS_OF_SPACE = /\s+/g;

/** What the receiver sees first: whose photo it is and where it came from. */
function sharedPhotoFileName(title: string): string {
  const name = title.replace(UNSAFE_FILE_CHARACTERS, ' ').replace(RUNS_OF_SPACE, ' ').trim();
  return `${name.slice(0, 80).trim() || 'PackRat photo'}.jpg`;
}

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
  // expo-image can report a load more than once; only the first one shares.
  const captureStarted = useRef(false);

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

  const sharePhoto = ({ post, imageKey }: { post: Post; imageKey: string }) => {
    captureStarted.current = false;
    const title = post.author
      ? t('feed.photoFileName', { name: displayName(post.author) })
      : t('feed.photoFileNameNoAuthor');
    setPending({ imageKey, fileName: sharedPhotoFileName(title), size: null });
  };

  const capture = async ({
    size,
    fileName,
  }: {
    size: { width: number; height: number };
    fileName: string;
  }) => {
    try {
      const scale = Math.min(1, MAX_SHARE_EDGE / Math.max(size.width, size.height));
      const uri = await captureRef(markRef, {
        format: 'jpg',
        quality: 0.9,
        result: 'tmpfile',
        width: Math.round(size.width * scale),
        height: Math.round(size.height * scale),
      });
      const named = new File(Paths.cache, fileName);
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
    if (captureStarted.current || !pending) return;
    captureStarted.current = true;
    const size = { width: event.source.width, height: event.source.height };
    const { fileName } = pending;
    setPending((current) => (current ? { ...current, size } : current));
    // Let the mark lay out over the loaded photo before capturing.
    requestAnimationFrame(() => requestAnimationFrame(() => capture({ size, fileName })));
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
              if (captureStarted.current) return;
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
