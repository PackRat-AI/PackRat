import { CreatePostScreen } from '@packrat/app/feed/screens/CreatePostScreen';
import { useRouter } from 'expo-router';

export default function CreatePostRoute() {
  const router = useRouter();

  return <CreatePostScreen onSuccess={() => router.back()} />;
}
