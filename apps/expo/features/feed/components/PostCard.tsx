import { createDropdownItem, DropdownMenu } from '@packrat/ui/src/dropdown-menu';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { getRelativeTime } from 'expo-app/lib/utils/getRelativeTime';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated';
import { useTogglePostLike, useTogglePostSave } from '../hooks/usePostMutations';
import type { Post } from '../types';
import { displayName, taggedSummary } from '../utils/mentions';
import { postShareUrl } from '../utils/share';
import { MentionText } from './MentionText';
import { PersonAvatar } from './PersonAvatar';
import { PhotoCarousel } from './PhotoCarousel';
import { PhotoViewer } from './PhotoViewer';
import type { usePostActions } from './usePostActions';

const LONG_CAPTION_CHARS = 220;
const LONG_CAPTION_LINES = 4;

/**
 * One post in the feed: author, photos, actions, caption, who was tagged, and a way into the
 * comments. `actions` comes from the hosting screen so its dialogs render once.
 */
export function PostCard({
  post,
  actions,
  onOpenComments,
  showCommentsLink = true,
}: {
  post: Post;
  actions: ReturnType<typeof usePostActions>;
  onOpenComments: (post: Post) => void;
  showCommentsLink?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const like = useTogglePostLike();
  const save = useTogglePostSave();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [heartBurst, setHeartBurst] = useState(0);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const tags = post.tags ?? [];
  const caption = post.caption?.trim() ? post.caption : null;
  const isLongCaption =
    !!caption &&
    (caption.length > LONG_CAPTION_CHARS || caption.split('\n').length > LONG_CAPTION_LINES + 1);
  const authorName = post.author ? displayName(post.author) : t('feed.unknownPerson');
  const tagLine = taggedSummary(tags);
  const shareUrl = postShareUrl(post);

  // Double-tap only ever likes; undoing a like is the heart button's job.
  const likeFromPhoto = () => {
    setHeartBurst((n) => n + 1);
    clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setHeartBurst(0), 650);
    if (!post.likedByMe) like.mutate(post);
  };

  const shareItems = [
    ...(shareUrl
      ? [
          createDropdownItem({
            actionKey: 'link',
            title: t('feed.shareLink'),
            icon: { name: 'link' },
          }),
        ]
      : []),
    ...(post.images[photoIndex]
      ? [
          createDropdownItem({
            actionKey: 'photo',
            title: post.images.length > 1 ? t('feed.shareThisPhoto') : t('feed.sharePhoto'),
            icon: { name: 'image-outline' },
          }),
        ]
      : []),
  ];

  const captionText = (variant: 'body' | 'callout') =>
    caption ? (
      <View className="gap-0.5">
        <MentionText
          text={caption}
          people={tags}
          variant={variant}
          numberOfLines={isLongCaption && !captionExpanded ? LONG_CAPTION_LINES : undefined}
          selectable
          testID={testIds.feed.postCaption(post.id)}
        />
        {isLongCaption ? (
          <Pressable
            onPress={() => setCaptionExpanded((v) => !v)}
            className="min-h-[32px] justify-center self-start"
            accessibilityRole="button"
            testID={testIds.feed.captionMore(post.id)}
          >
            <Text variant="callout" className="font-medium text-muted-foreground">
              {captionExpanded ? t('feed.captionLess') : t('feed.captionMore')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    ) : null;

  return (
    <View
      className="overflow-hidden rounded-xl border border-border bg-card"
      testID={testIds.feed.post(post.id)}
    >
      {/* Header */}
      <View className="flex-row items-center gap-3 py-2 pl-4 pr-1">
        <PersonAvatar person={post.author} size={40} />
        <View className="flex-1">
          <Text variant="callout" className="font-semibold" numberOfLines={1}>
            {authorName}
          </Text>
          <Text variant="caption1" className="text-muted-foreground">
            {getRelativeTime({ dateValue: post.createdAt })}
            {post.captionEditedAt ? ` · ${t('feed.edited')}` : ''}
          </Text>
        </View>
        <DropdownMenu
          items={actions.menuItems(post)}
          onItemPress={({ actionKey }) => actions.onMenuItemPress(post, actionKey)}
          testID={testIds.feed.postMenu(post.id)}
        >
          <View
            accessibilityRole="button"
            accessibilityLabel={t('feed.more')}
            className="h-12 w-12 items-center justify-center"
          >
            <Icon name="dots-vertical" size={24} color={colors.grey} />
          </View>
        </DropdownMenu>
      </View>

      {post.images.length === 0 ? (
        <View className="px-4 pb-1">{captionText('body')}</View>
      ) : (
        <View>
          <PhotoCarousel
            images={post.images}
            index={photoIndex}
            onIndexChange={setPhotoIndex}
            onOpen={setViewerIndex}
            onDoubleTap={likeFromPhoto}
          />
          {heartBurst > 0 ? (
            <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
              <Animated.View key={heartBurst} entering={ZoomIn.springify()} exiting={FadeOut}>
                <Icon name="heart" size={88} color="white" />
              </Animated.View>
            </View>
          ) : null}
        </View>
      )}

      {/* Actions */}
      <View className="flex-row items-center px-1">
        <Pressable
          onPress={() => like.mutate(post)}
          className="h-12 min-w-[48px] flex-row items-center justify-center gap-1.5 px-3"
          accessibilityRole="button"
          accessibilityLabel={
            post.likedByMe
              ? t('feed.unlike', { count: post.likeCount })
              : t('feed.like', { count: post.likeCount })
          }
          android_ripple={{ color: colors.grey5, borderless: true }}
          testID={testIds.feed.likeButton(post.id)}
        >
          <Icon
            name={post.likedByMe ? 'heart' : 'heart-outline'}
            size={24}
            color={post.likedByMe ? colors.destructive : colors.grey}
          />
          <Text variant="callout" className="text-muted-foreground">
            {post.likeCount}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onOpenComments(post)}
          className="h-12 min-w-[48px] flex-row items-center justify-center gap-1.5 px-3"
          accessibilityRole="button"
          accessibilityLabel={t('feed.commentsA11y', { count: post.commentCount })}
          android_ripple={{ color: colors.grey5, borderless: true }}
          testID={testIds.feed.commentsButton(post.id)}
        >
          <Icon name="comment-outline" size={24} color={colors.grey} />
          <Text variant="callout" className="text-muted-foreground">
            {post.commentCount}
          </Text>
        </Pressable>
        {shareItems.length > 0 ? (
          <DropdownMenu
            items={shareItems}
            onItemPress={({ actionKey }) => {
              if (actionKey === 'link') actions.share.shareLink(post);
              const image = post.images[photoIndex];
              if (actionKey === 'photo' && image) actions.share.sharePhoto(image);
            }}
            enabled={!actions.share.isPreparingPhoto}
            testID={testIds.feed.shareButton(post.id)}
          >
            <View
              accessibilityRole="button"
              accessibilityLabel={t('feed.share')}
              className="h-12 w-12 items-center justify-center"
            >
              <Icon name="share-variant-outline" size={24} color={colors.grey} />
            </View>
          </DropdownMenu>
        ) : null}
        <View className="flex-1" />
        <Pressable
          onPress={() => save.mutate(post)}
          className="h-12 w-12 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={post.savedByMe ? t('feed.unsave') : t('feed.save')}
          android_ripple={{ color: colors.grey5, borderless: true }}
          testID={testIds.feed.saveButton(post.id)}
        >
          <Icon
            name={post.savedByMe ? 'bookmark' : 'bookmark-outline'}
            size={24}
            color={post.savedByMe ? colors.primary : colors.grey}
          />
        </Pressable>
      </View>

      {/* Details */}
      <View className="gap-1.5 px-4 pb-3">
        {post.images.length > 0 ? captionText('callout') : null}
        {tagLine ? (
          <View
            className="flex-row items-center gap-1.5"
            accessible
            testID={testIds.feed.postTags(post.id)}
          >
            <Icon name="account-multiple" size={16} color={colors.grey} />
            <Text variant="footnote" numberOfLines={1} className="flex-1">
              <Text variant="footnote" className="text-muted-foreground">
                {t('feed.with')}
              </Text>
              <Text variant="footnote" className="font-semibold">
                {tagLine}
              </Text>
            </Text>
          </View>
        ) : null}
        {showCommentsLink && post.commentCount > 0 ? (
          <Pressable
            onPress={() => onOpenComments(post)}
            className="min-h-[32px] justify-center self-start"
            accessibilityRole="button"
            testID={testIds.feed.viewComments(post.id)}
          >
            <Text variant="callout" className="text-muted-foreground">
              {post.commentCount === 1
                ? t('feed.viewOneComment')
                : t('feed.viewAllComments', { count: post.commentCount })}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <PhotoViewer
        images={post.images}
        startIndex={viewerIndex}
        onClose={() => setViewerIndex(null)}
      />
    </View>
  );
}
