import type { AlertRef } from '@packrat/ui/nativewindui';
import { Alert, ListItem, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Platform, View } from 'react-native';
import { useUserPackItems } from '../hooks';

export function GearInventoryTile() {
  const { t } = useTranslation();
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
            <Text className="mr-2">{t('packs.itemsCount', { count: gearInventoryCount })}</Text>
            <ChevronRight />
          </View>
        }
        item={{
          title: t('packs.gearInventory'),
        }}
        onPress={handlePress}
        target="Cell"
        index={0}
        removeSeparator={Platform.OS === 'ios'}
      />
      <Alert
        title={t('packs.noItemsYet')}
        message={t('packs.createItemsOrAdd')}
        materialIcon={{ name: 'information-outline' }}
        materialWidth={370}
        buttons={[
          {
            text: t('packs.gotIt'),
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
