import { Icon } from '@roninoss/icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { ListItem } from 'nativewindui/List';
import { Text } from 'nativewindui/Text';
import { useColorScheme } from '~/lib/useColorScheme';

export function PackTemplatesTile() {
  const router = useRouter();

  const handlePress = () => {
    // if (!currentPack) {
    //   alertRef.current?.show();
    //   return;
    // }
    router.push('/pack-templates');
  };

  const packTemplateCount = 10;

  return (
    <ListItem
      className="ios:pl-0 pl-2"
      titleClassName="text-lg"
      leftView={
        <View className="px-3">
          <View className="h-6 w-6 items-center justify-center rounded-md bg-sky-400">
            <Icon name="file-document-multiple" size={15} color="white" />
          </View>
        </View>
      }
      rightView={
        <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
          <Text className="mr-2">{`${packTemplateCount} templates`}</Text>
          <ChevronRight />
        </View>
      }
      item={{
        title: 'Pack Templates',
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
