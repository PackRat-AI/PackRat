import { ListItem, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { Platform, View } from 'react-native';
import { useHasMinimumInventory } from '../hooks/useHasMinimumInventory';

export function SeasonSuggestionsTile() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const { hasMinimumItems } = useHasMinimumInventory(20);

  // Only show tile if user has minimum items
  if (!hasMinimumItems) {
    return null;
  }

  const handlePress = () => {
    router.push('/season-suggestions');
  };

  return (
    <ListItem
      className="ios:pl-0 pl-2"
      titleClassName="text-lg"
      leftView={
        <View className="px-3">
          <View className="h-6 w-6 items-center justify-center rounded-md bg-orange-500">
            <Icon
              materialIcon={{ type: 'MaterialIcons', name: 'eco' }}
              ios={{ name: 'leaf' }}
              size={15}
              color="white"
            />
          </View>
        </View>
      }
      rightView={
        <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
          <Text variant="callout" className="ios:px-0 px-2 text-muted-foreground">
            {t('packs.aiPowered')}
          </Text>
          <Icon name="chevron-right" size={17} color={colors.grey} />
        </View>
      }
      item={{
        title: t('packs.seasonSuggestions'),
        subTitle: 'Pack ideas for the season',
      }}
      onPress={handlePress}
      target="Cell"
      index={0}
      removeSeparator={Platform.OS === 'ios'}
    />
  );
}
