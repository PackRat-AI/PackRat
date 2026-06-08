import { ListItem, Text } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { useAtom } from 'jotai';
import { Platform, View } from 'react-native';
import { seasonSuggestionsOpenedAtom } from '../atoms/seasonSuggestionsAtoms';
import { useHasMinimumInventory } from '../hooks/useHasMinimumInventory';

export function SeasonSuggestionsTile() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const { hasMinimumItems } = useHasMinimumInventory(20);
  const [opened, setOpened] = useAtom(seasonSuggestionsOpenedAtom);

  if (!hasMinimumItems) {
    return null;
  }

  const showNewBadge = !opened;

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
            {showNewBadge && (
              <View className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background bg-red-500" />
            )}
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
