import { PostByIdScreen } from 'expo-app/features/feed';
import { useLocalSearchParams } from 'expo-router';

/** `packrat://post/{id}` — the same post screen the feed opens. */
export default function PostDeepLinkRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PostByIdScreen postId={Number(id)} />;
}
