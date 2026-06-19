import { CreatePostScreen } from 'expo-app/features/feed';
import { ProGate } from 'expo-app/features/purchases';
import { useRouter } from 'expo-router';

export default function CreatePostRoute() {
  const router = useRouter();

  return (
    <ProGate>
      <CreatePostScreen onSuccess={() => router.back()} />
    </ProGate>
  );
}
