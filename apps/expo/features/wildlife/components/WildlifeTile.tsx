import { ListItem, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { Platform, View } from 'react-native';
import { useWildlifeHistory } from '../hooks/useWildlifeHistory';

export function WildlifeTile() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const { history } = useWildlifeHistory();

  const handlePress = () => {
    router.push('/wildlife');
  };

  const subTitle =
    history.length === 1
      ? t('wildlife.identifiedCountSingular')
      : history.length > 1
        ? t('wildlife.identifiedCount', { count: history.length })
        : t('wildlife.identifyPlantsAndAnimals');

  return (
    <ListItem
      className="ios:pl-0 pl-2"
      titleClassName="text-lg"
      leftView={
        <View className="px-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
            <Icon ios={{ useMaterialIcon: true }} name="leaf" size={24} color={colors.primary} />
          </View>
        </View>
      }
      rightView={
        <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
          <Text variant="callout" className="ios:px-0 px-2 text-muted-foreground">
            {t('wildlife.offline')}
          </Text>
          <Icon name="chevron-right" size={17} color={colors.grey} />
        </View>
      }
      item={{
        title: t('wildlife.wildlifeIdentification'),
        subTitle,
      }}
      onPress={handlePress}
      target="Cell"
      index={0}
      removeSeparator={Platform.OS === 'ios'}
    />
  );
}
