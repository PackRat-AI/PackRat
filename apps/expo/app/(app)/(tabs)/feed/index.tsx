import { FeedScreen } from 'expo-app/features/feed';
import { ProGate } from 'expo-app/features/purchases';

export default function FeedRoute() {
  return (
    <ProGate>
      <FeedScreen />
    </ProGate>
  );
}
