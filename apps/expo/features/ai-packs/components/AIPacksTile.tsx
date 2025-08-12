import { ListItem } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

export const AIPacksTile = () => {
  const router = useRouter();
  const { colors } = useColorScheme();
  const user = useUser();

  if (user?.role !== 'admin') {
    return null;
  }

  const handlePress = () => {
    router.push('/admin/ai-packs');
  };

  return (
    <ListItem
      className={'ios:pl-0 pl-2'}
      titleClassName="text-lg"
      leftView={
        <View className="px-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Icon ios={{ useMaterialIcon: true }} name="brain" size={24} color={colors.primary} />
          </View>
        </View>
      }
      rightView={
        <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
          <Icon name="chevron-right" size={17} color={colors.grey} />
        </View>
      }
      item={{
        title: 'AI Packs',
        subTitle: 'Generate packs with AI',
      }}
      onPress={handlePress}
      target="Cell"
      index={0}
    />
  );
};
