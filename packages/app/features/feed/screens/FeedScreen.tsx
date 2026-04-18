import { ActivityIndicator, Button, LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import { userStore } from 'expo-app/features/auth/store';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { PostCard } from '../components/PostCard';
import { useDeletePost, useFeed, useTogglePostLike } from '../hooks';
import type { Post } from '../types';

export const FeedScreen = () => {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const router = useRouter();
  const currentUserId = userStore.id.peek() as number | undefined;

  const { data, isLoading, isRefetching, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useFeed();

  const { mutate: toggleLike } = useTogglePostLike();
  const { mutate: deletePost } = useDeletePost();

  const posts = data?.pages.flatMap((page) => page.items) ?? [];

  const handleLike = useCallback(
    (postId: number) => {
      toggleLike(postId);
    },
    [toggleLike],
  );

  const handleDelete = useCallback(
    (postId: number) => {
      deletePost(postId);
    },
    [deletePost],
  );

  const handleCreatePost = useCallback(() => {
    router.push('/feed/create');
  }, [router]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard
        post={item}
        onLike={handleLike}
        onDelete={handleDelete}
        currentUserId={currentUserId}
      />
    ),
    [handleLike, handleDelete, currentUserId],
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View className="py-4 items-center">
        <ActivityIndicator />
      </View>
    );
  }, [isFetchingNextPage]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View className="flex-1 items-center justify-center py-20 gap-4">
        <Icon name="image-multiple" size={64} color={colors.grey2} />
        <Text className="text-lg font-semibold text-center">{t('feed.noPosts')}</Text>
        <Text className="text-sm text-muted-foreground text-center">{t('feed.beTheFirst')}</Text>
        <Button onPress={handleCreatePost} variant="primary">
          <Text>{t('feed.sharePhoto')}</Text>
        </Button>
      </View>
    );
  }, [isLoading, colors.grey2, t, handleCreatePost]);

  return (
    <View className="flex-1 bg-background">
      <LargeTitleHeader
        title={t('feed.feed')}
        rightView={() => (
          <View className="px-4">
            <Button variant="plain" onPress={handleCreatePost}>
              <Icon name="plus" size={24} color={colors.primary} />
            </Button>
          </View>
        )}
      />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
        />
      )}
    </View>
  );
};
