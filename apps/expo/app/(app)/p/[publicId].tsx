import { SharedPostScreen } from 'expo-app/features/feed';
import { useLocalSearchParams } from 'expo-router';

/** A shared post link: `https://packratai.com/p/{publicId}` or `packrat://p/{publicId}`. */
export default function SharedPostRoute() {
  const { publicId } = useLocalSearchParams<{ publicId: string }>();
  return <SharedPostScreen publicId={publicId ?? ''} />;
}
