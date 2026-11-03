import { PostByIdScreen } from 'expo-app/features/feed';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function PostDetailRoute() {
  const enableFeed = useFeatureFlag('enableFeed');
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!enableFeed) return <Redirect href="/" />;
  return <PostByIdScreen postId={Number(id)} />;
}
