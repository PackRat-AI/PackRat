import { ListItem } from '@packrat/ui/nativewindui';
import { Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { usePackTemplates } from '../hooks';

export function PackTemplatesTile() {
  const router = useRouter();
  const packTemplates = usePackTemplates();

  const handlePress = () => {
    router.push('/pack-templates');
  };

  const packTemplateCount = packTemplates.length;

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
