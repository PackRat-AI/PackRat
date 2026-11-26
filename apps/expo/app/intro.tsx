import { IntroScreen } from 'expo-app/features/intro';
import { router } from 'expo-router';

/** Replays the first-launch intro on demand, from the developer tools. */
export default function IntroReplayScreen() {
  return <IntroScreen onFinished={() => router.back()} />;
}
