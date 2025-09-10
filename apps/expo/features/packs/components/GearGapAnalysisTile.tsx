import type { AlertRef } from '@packrat/ui/nativewindui';
import { Alert, ListItem, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { type Href, useRouter } from 'expo-router';
import { useRef } from 'react';
import { Platform, View } from 'react-native';
import { useCurrentPack } from '../hooks';

export function GearGapAnalysisTile() {
  const router = useRouter();
  const currentPack = useCurrentPack();
  const alertRef = useRef<AlertRef>(null);

  const itemCount = currentPack?.items?.length ?? 0;
  const route: Href | null = currentPack ? `/gear-gap-analysis/${currentPack.id}` : null;

  const handlePress = () => {
    if (!route) {
      alertRef.current?.show();
      return;
    }
    router.push(route);
  };

  return (
    <>
      <ListItem
        className="ios:pl-0 pl-2"
        titleClassName="text-lg"
        leftView={
          <View className="px-3">
            <View className="h-6 w-6 items-center justify-center rounded-md bg-green-600">
              <Icon name="checkmark-circle" size={15} color="white" />
            </View>
          </View>
        }
        rightView={
          <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
            <Text className="mr-2">{`${itemCount} items`}</Text>
            <ChevronRight />
          </View>
        }
        item={{
          title: 'Gear Gap Analysis',
        }}
        onPress={handlePress}
        target="Cell"
        index={0}
        removeSeparator={Platform.OS === 'ios'}
      />
      <Alert
        title="No Packs Yet"
        message="Create a pack to analyze missing gear for your adventures."
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
