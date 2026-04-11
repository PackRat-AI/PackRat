import { Text } from '@packrat/ui/nativewindui';
import { useQuery } from '@tanstack/react-query';
import { userStore } from 'expo-app/features/auth/store';
import { PostDetailScreen } from 'expo-app/features/feed';
import type { Post } from 'expo-app/features/feed/types';
import axiosInstance from 'expo-app/lib/api/client';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function PostDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUserId = userStore.id.peek() as number | undefined;

  const { data: post, isLoading } = useQuery({
    queryKey: ['feed', Number(id)],
    queryFn: async () => {
      const response = await axiosInstance.get<Post>(`/api/feed/${id}`);
      return response.data;
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
