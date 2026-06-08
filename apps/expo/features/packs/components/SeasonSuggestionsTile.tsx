import { ListItem } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import { useSeasonSuggestionsPrefs } from 'expo-app/features/packs/atoms/seasonSuggestionsAtoms';
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
  const { opened, setOpened } = useSeasonSuggestionsPrefs();

  if (!hasMinimumItems) {
    return null;
  }

  const handlePress = () => {
    setOpened(true);
    router.push('/season-suggestions');
  };

  return (
    <ListItem
      className="ios:pl-0 pl-2"
      titleClassName="text-lg"
      leftView={
        <View className="px-3">
          <View className="relative">
            <View className="h-6 w-6 items-center justify-center rounded-md bg-orange-500">
              <Icon
                name="leaf"
                namingScheme="sfSymbol"
                materialIcon={{ type: 'MaterialIcons', name: 'eco' }}
                size={15}
                color="white"
              />
            </View>
            {!opened && (
              <View className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background bg-red-500" />
            )}
          </View>
        </View>
      }
      rightView={
        <View className="flex-1 items-center justify-center px-4">
          <Icon name="chevron-right" size={17} color={colors.grey} />
        </View>
      }
      item={{
        title: t('packs.seasonSuggestions'),
        subTitle: 'AI generated pack ideas for the season',
      }}
      onPress={handlePress}
      target="Cell"
      index={0}
      removeSeparator={Platform.OS === 'ios'}
    />
  );
}
