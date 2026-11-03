import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { withAuthWall } from 'expo-app/features/auth/hocs/withAuthWall';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { usePost, useSharedPost } from '../hooks/usePost';
import type { Post } from '../types';
import { EditCaptionScreen } from './EditCaptionScreen';
import { FeedAuthWall } from './FeedAuthWall';
import { PostDetailScreen } from './PostDetailScreen';

function Unavailable() {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  return (
    <View
      className="flex-1 items-center justify-center gap-3 bg-background px-8"
      testID={testIds.feed.postUnavailable}
    >
      <Stack.Screen options={{ title: t('feed.postTitle') }} />
      <Icon name="image-off-outline" size={56} color={colors.grey} />
      <Text className="text-center text-xl font-medium">{t('feed.postUnavailable')}</Text>
      <Text className="text-center text-muted-foreground" wrap>
        {t('feed.postUnavailableBody')}
      </Text>
    </View>
  );
}

function Loading() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Stack.Screen options={{ title: t('feed.postTitle') }} />
      <ActivityIndicator size="large" />
    </View>
  );
}

function render({
  query,
  render: show,
}: {
  query: { isLoading: boolean; data: Post | undefined };
  render: (post: Post) => React.ReactNode;
}) {
  if (query.isLoading) return <Loading />;
  if (!query.data) return <Unavailable />;
  return show(query.data);
}

/** A post by id — from the feed, a notification, or `packrat://post/{id}`. */
export const PostByIdScreen = withAuthWall({
  Component: ({ postId }: { postId: number }) =>
    render({ query: usePost(postId), render: (post) => <PostDetailScreen post={post} /> }),
  AuthWall: FeedAuthWall,
});

/** A shared link — `https://packratai.com/p/{publicId}` or `packrat://p/{publicId}`. */
export const SharedPostScreen = withAuthWall({
  Component: ({ publicId }: { publicId: string }) =>
    render({ query: useSharedPost(publicId), render: (post) => <PostDetailScreen post={post} /> }),
  AuthWall: FeedAuthWall,
});

export function EditCaptionRouteScreen({ postId }: { postId: number }) {
  return render({ query: usePost(postId), render: (post) => <EditCaptionScreen post={post} /> });
}
