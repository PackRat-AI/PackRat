import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

interface SyncBannerProps {
  title: string;
  isReAuthentication?: boolean;
}

export default function SyncBanner({ title, isReAuthentication }: SyncBannerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useColorScheme();

  const handlePress = () =>
    router.push({
      pathname: '/auth',
      params: { redirectTo: pathname },
    });

  return (
    <Pressable
      onPress={handlePress}
      className="mx-4 my-2 flex-row items-center justify-between rounded-xl bg-blue-50 p-3"
    >
      <View className="flex-row items-center gap-2">
        {isReAuthentication ? (
          <Icon
            materialIcon={{ name: 'cloud-off', type: 'MaterialIcons' }}
            ios={{
              name: 'icloud.slash',
            }}
            size={20}
            color={colors.primary}
          />
        ) : (
          <Icon name="cloud-outline" size={20} color={colors.primary} />
        )}
        <Text className="font-medium text-blue-800">{title}</Text>
      </View>
      <Icon name="chevron-right" size={16} color={colors.primary} />
    </Pressable>
  );
}
