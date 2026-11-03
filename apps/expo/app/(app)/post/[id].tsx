import { PostByIdScreen } from 'expo-app/features/feed';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect, useLocalSearchParams } from 'expo-router';

/** `packrat://post/{id}` — the same post screen the feed opens. */
export default function PostDeepLinkRoute() {
  const enableFeed = useFeatureFlag('enableFeed');
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!enableFeed) return <Redirect href="/" />;
  return <PostByIdScreen postId={Number(id)} />;
}
