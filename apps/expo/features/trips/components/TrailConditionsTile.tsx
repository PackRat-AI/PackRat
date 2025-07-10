import { Alert } from '@packrat/ui/nativewindui';
import type { AlertRef } from '@packrat/ui/nativewindui';
import { ListItem } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { featureFlags } from 'expo-app/config';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { View } from 'react-native';

export function TrailConditionsTile() {
  const router = useRouter();

  const alertRef = useRef<AlertRef>(null);

  const handlePress = () => {
    // if (!currentPack) return alertRef.current?.show();
    router.push('/trail-conditions');
  };

  if (!featureFlags.enableTrips) return null;

  return (
    <>
      <ListItem
        className={'ios:pl-0 pl-2'}
        titleClassName="text-lg"
        leftView={
          <View className="px-3">
            <View className="h-6 w-6 items-center justify-center rounded-md bg-violet-500">
              <Icon name="soccer-field" size={15} color="white" />
            </View>
          </View>
        }
        rightView={
          <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
            <ChevronRight />
          </View>
        }
        item={{
          title: 'Trail Conditions',
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
