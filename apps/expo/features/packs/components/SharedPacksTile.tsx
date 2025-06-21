import { Icon } from '@roninoss/icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { ListItem } from 'nativewindui/List';
import { useColorScheme } from '~/lib/useColorScheme';

export function SharedPacksTile() {
  const router = useRouter();

  const handlePress = () => {
    // if (!currentPack) {
    //   alertRef.current?.show();
    //   return;
    // }
    router.push('/shared-packs');
  };

  return (
    <ListItem
      className="ios:pl-0 pl-2"
      titleClassName="text-lg"
      rightView={
        <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
          <ChevronRight />
        </View>
      }
      leftView={
        <View className="px-3">
          <View className="h-6 w-6 items-center justify-center rounded-md bg-sky-500">
            <Icon name="account-multiple" size={15} color="white" />
          </View>
        </View>
      }
      item={{
        title: 'Shared Packs',
      }}
      onPress={handlePress}
      target="Cell"
      index={0}
    />
  );
}

function ChevronRight() {
  const { colors } = useColorScheme();
  return <Icon name="chevron-right" size={17} color={colors.grey} />;
}
