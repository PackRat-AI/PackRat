import { Button } from '@packrat/ui/src/button';
import { createDropdownItem, DropdownMenu } from '@packrat/ui/src/dropdown-menu';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import { Icon, type MaterialIconName } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { PostCard } from '../components/PostCard';
import { usePostActions } from '../components/usePostActions';
import { useFeed } from '../hooks/useFeed';
import type { FeedScope, Post } from '../types';

function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: MaterialIconName;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  const { colors } = useColorScheme();
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-20">
      <Icon name={icon} size={56} color={colors.grey} />
      <Text className="text-center text-xl font-medium">{title}</Text>
      <Text className="text-center text-muted-foreground" wrap>
        {body}
      </Text>
      {action}
    </View>
  );
}

/**
 * A list of posts: the community feed, newest first, or the viewer's Saved or Tagged-in posts.
 * Pull down to refresh; scrolling to the end loads more.
 */
export function PostListScreen({ scope }: { scope: FeedScope }) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const router = useRouter();
  const feed = useFeed(scope);
  const actions = usePostActions();
  const posts = feed.data?.pages.flatMap((page) => page.items) ?? [];

  const openPost = (post: Post) =>
    router.push({ pathname: '/feed/[id]', params: { id: String(post.id) } });
  const compose = () => router.push('/feed/create');

  const title =
    scope === 'saved'
      ? t('feed.saved')
      : scope === 'tagged'
        ? t('feed.taggedIn')
        : t('feed.communityFeed');

  const headerRight =
    scope === 'all'
      ? () => (
          <View className="flex-row items-center">
            <Pressable
              onPress={compose}
              className="h-12 w-12 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel={t('feed.newPost')}
              android_ripple={{ color: colors.grey5, borderless: true, radius: 24 }}
              testID={testIds.feed.newPostButton}
            >
              <Icon name="pencil-plus-outline" size={24} color={colors.foreground} />
            </Pressable>
            <DropdownMenu
              items={[
                createDropdownItem({
                  actionKey: 'saved',
                  title: t('feed.saved'),
                  icon: { name: 'bookmark-outline' },
                }),
                createDropdownItem({
                  actionKey: 'tagged',
                  title: t('feed.taggedIn'),
                  icon: { name: 'account-box-outline' },
                }),
                createDropdownItem({
                  actionKey: 'settings',
                  title: t('feed.feedSettings'),
                  icon: { name: 'cog-outline' },
                }),
              ]}
              onItemPress={({ actionKey }) => {
                if (actionKey === 'saved') router.push('/feed/saved');
                else if (actionKey === 'tagged') router.push('/feed/tagged');
                else if (actionKey === 'settings') router.push('/feed/settings');
              }}
              testID={testIds.feed.moreMenu}
            >
              <View
                accessibilityRole="button"
                accessibilityLabel={t('feed.more')}
                className="h-12 w-12 items-center justify-center"
              >
                <Icon name="dots-vertical" size={24} color={colors.foreground} />
              </View>
            </DropdownMenu>
          </View>
        )
      : undefined;

  const empty = feed.isError ? (
    <EmptyState
      icon="cloud-off-outline"
      title={t('feed.loadFailed')}
      body=""
      action={
        <Button variant="tonal" onPress={() => feed.refetch()}>
          <Text>{t('feed.tryAgain')}</Text>
        </Button>
      }
    />
  ) : scope === 'saved' ? (
    <EmptyState
      icon="bookmark-outline"
      title={t('feed.nothingSaved')}
      body={t('feed.nothingSavedBody')}
    />
  ) : scope === 'tagged' ? (
    <EmptyState icon="account-box-outline" title={t('feed.noTags')} body={t('feed.noTagsBody')} />
  ) : (
    <EmptyState
      icon="image-multiple-outline"
      title={t('feed.noPosts')}
      body={t('feed.noPostsBody')}
      action={
        <Button className="mt-2" onPress={compose} testID={testIds.feed.emptyNewPostButton}>
          <Icon name="pencil-plus-outline" size={18} color={colors.primaryForeground} />
          <Text className="font-medium text-primary-foreground">{t('feed.writePost')}</Text>
        </Button>
      }
    />
  );

  return (
    <View className="flex-1 bg-background" testID={testIds.feed.list(scope)}>
      <Stack.Screen options={{ title, headerRight }} />
      {feed.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(post) => String(post.id)}
          renderItem={({ item }) => (
            <PostCard post={item} actions={actions} onOpenComments={openPost} />
          )}
          ItemSeparatorComponent={() => <View className="h-3" />}
          contentContainerStyle={{ flexGrow: 1, padding: 12, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefetching && !feed.isFetchingNextPage}
              onRefresh={() => {
                feed.refetch();
              }}
            />
          }
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <View className="items-center py-4">
                <ActivityIndicator />
              </View>
            ) : undefined
          }
          ListEmptyComponent={empty}
        />
      )}
      {actions.dialogs}
    </View>
  );
}
