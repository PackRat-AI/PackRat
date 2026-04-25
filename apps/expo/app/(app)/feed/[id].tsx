import { Text } from '@packrat/ui/nativewindui';
import { useQuery } from '@tanstack/react-query';
import { userStore } from 'expo-app/features/auth/store';
import { PostDetailScreen } from 'expo-app/features/feed';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function PostDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUserId = userStore.id.peek() as number | undefined;

  const { data: post, isLoading } = useQuery({
    queryKey: ['feed', Number(id)],
    queryFn: async () => {
      const { data, error } = await apiClient.feed({ postId: id }).get();
      if (error) throw new Error(`Failed to fetch post: ${error.value}`);
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!post) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text>Post not found</Text>
      </View>
    );
  }

  return <PostDetailScreen post={post} currentUserId={currentUserId} />;
}
