import { PostByIdScreen } from 'expo-app/features/feed';
import { useLocalSearchParams } from 'expo-router';

export default function PostDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PostByIdScreen postId={Number(id)} />;
}
