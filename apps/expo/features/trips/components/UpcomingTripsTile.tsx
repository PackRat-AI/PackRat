import { Icon } from '@roninoss/icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { ListItem } from 'nativewindui/List';
import { Text } from 'nativewindui/Text';
import { useColorScheme } from '~/lib/useColorScheme';
import { Alert } from 'nativewindui/Alert';
import { useRef } from 'react';
import { AlertRef } from 'nativewindui/Alert/types';
import { featureFlags } from '~/config';

export function UpcomingTripsTile() {
  const router = useRouter();

  const alertRef = useRef<AlertRef>(null);

  const handlePress = () => {
    // if (!currentPack) return alertRef.current?.show();
    router.push('/upcoming-trips');
  };

  if (!featureFlags.enableTrips) return null;

  return (
    <>
      <ListItem
        className={'ios:pl-0 pl-2'}
        titleClassName="text-lg"
        leftView={
          <View className="px-3">
            <View className="h-6 w-6 items-center justify-center rounded-md bg-red-500">
              <Icon name="map" size={15} color="white" />
            </View>
          </View>
        }
        rightView={
          <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
            <View className="h-5 w-5 items-center justify-center rounded-full bg-primary">
              <Text variant="footnote" className="font-bold leading-4 text-primary-foreground">
                {0}
              </Text>
            </View>
            <ChevronRight />
          </View>
        }
        item={{
          title: 'Upcoming Trips',
        }}
        onPress={handlePress}
        target="Cell"
        index={0}
      />
      <Alert
        title="No Trips Yet"
        message="Create trips, see which ones are near the corner!"
        materialIcon={{ name: 'information-outline' }}
        materialWidth={370}
        buttons={[
          {
            text: 'Got it',
            style: 'default',
          },
        ]}
        ref={alertRef}
      />
    </>
  );
}

function ChevronRight() {
  const { colors } = useColorScheme();
  return <Icon name="chevron-right" size={17} color={colors.grey} />;
}
