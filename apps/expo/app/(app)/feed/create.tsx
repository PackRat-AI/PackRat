import { CreatePostScreen } from 'app/features/feed';
import { useRouter } from 'expo-router';

export default function CreatePostRoute() {
  const router = useRouter();

  return <CreatePostScreen onSuccess={() => router.back()} />;
}
