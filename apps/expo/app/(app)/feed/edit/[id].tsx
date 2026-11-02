import { EditCaptionRouteScreen } from 'expo-app/features/feed';
import { useLocalSearchParams } from 'expo-router';

export default function EditCaptionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditCaptionRouteScreen postId={Number(id)} />;
}
