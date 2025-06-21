import { Icon } from '@roninoss/icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { ListItem } from 'nativewindui/List';
import { Text } from 'nativewindui/Text';
import { useColorScheme } from '~/lib/useColorScheme';
import { Alert } from 'nativewindui/Alert';
import { useRef } from 'react';
import { type AlertRef } from 'nativewindui/Alert/types';
import { useUserPackItems } from '../hooks';

export function GearInventoryTile() {
  const router = useRouter();
  const alertRef = useRef<AlertRef>(null);
  const items = useUserPackItems();

  const handlePress = () => {
    router.push('/gear-inventory');
  };

  const gearInventoryCount = items.length;

  return (
    <>
      <ListItem
        className="ios:pl-0 pl-2"
        titleClassName="text-lg"
        leftView={
          <View className="px-3">
            <View className="h-6 w-6 items-center justify-center rounded-md bg-gray-500">
              <Icon name="backpack" size={15} color="white" />
            </View>
          </View>
        }
        rightView={
          <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
            <Text className="mr-2">{`${gearInventoryCount} items`}</Text>
            <ChevronRight />
          </View>
        }
        item={{
          title: 'Gear Inventory',
        }}
        onPress={handlePress}
        target="Cell"
        index={0}
      />
      <Alert
        title="No Items Yet"
        message="Create your items or add items to your pack from our items catalog."
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
