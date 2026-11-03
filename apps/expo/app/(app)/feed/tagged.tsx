import { PostListScreen } from 'expo-app/features/feed';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function TaggedPostsRoute() {
  const enableFeed = useFeatureFlag('enableFeed');
  if (!enableFeed) return <Redirect href="/" />;
  return <PostListScreen scope="tagged" />;
}
