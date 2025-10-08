import { Alert, Button, useColorScheme } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useDeleteTrip} from '../hooks';

export function getTripDetailOptions(id: string) {
  return {
    title: 'Trip Details',
    headerRight: () => {
      const { colors } = useColorScheme();
      const router = useRouter();
      const deleteTrip = useDeleteTrip();


      return (
        <View className="flex-row items-center gap-2">
          <Alert
            title="Delete trip?"
            message="Are you sure you want to delete this trip? This action cannot be undone."
            buttons={[
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'OK',
                onPress: () => {
                  deleteTrip(id);
                  if (router.canGoBack()) router.back();
                },
              },
            ]}
          >
            <Button variant="plain" size="icon">
              <Icon name="trash-can-outline" color={colors.grey2} />
            </Button>
          </Alert>

          <Button
            variant="plain"
            size="icon"
            onPress={() => router.push({ pathname: '/trip/[id]/edit', params: { id } })}
          >
            <Icon name="pencil-box-outline" color={colors.grey2} />
          </Button>

          <Button
            variant="plain"
            size="icon"
            onPress={() => router.push({ pathname: '/trip/new', params: { copyFromTripId: id } })}
          >
            <Icon name="plus" color={colors.grey2} />
          </Button>
        </View>
      );
    },
  };
}
