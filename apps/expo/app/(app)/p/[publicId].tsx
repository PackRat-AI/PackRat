import { SharedPostScreen } from 'expo-app/features/feed';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect, useLocalSearchParams } from 'expo-router';

/** A shared post link: `https://packratai.com/p/{publicId}` or `packrat://p/{publicId}`. */
export default function SharedPostRoute() {
  const enableFeed = useFeatureFlag('enableFeed');
  const { publicId } = useLocalSearchParams<{ publicId: string }>();
  if (!enableFeed) return <Redirect href="/" />;
  return <SharedPostScreen publicId={publicId ?? ''} />;
}
