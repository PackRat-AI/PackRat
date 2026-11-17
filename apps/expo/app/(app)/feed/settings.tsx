import { FeedSettingsScreen } from 'expo-app/features/feed';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function FeedSettingsRoute() {
  const enableFeed = useFeatureFlag('enableFeed');
  if (!enableFeed) return <Redirect href="/" />;
  return <FeedSettingsScreen />;
}
