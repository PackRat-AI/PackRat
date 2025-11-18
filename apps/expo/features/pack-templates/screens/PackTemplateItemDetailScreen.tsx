import { Button, Text, useColorScheme } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { Chip } from 'expo-app/components/initial/Chip';
import { WeightBadge } from 'expo-app/components/initial/WeightBadge';
import { isAuthed } from 'expo-app/features/auth/store';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import {
  calculateTotalWeight,
  getNotes,
  getQuantity,
  hasNotes,
  isConsumable,
  isWorn,
  shouldShowQuantity,
} from 'expo-app/lib/utils/itemCalculations';
import { assertDefined } from 'expo-app/utils/typeAssertions';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, ScrollView, View } from 'react-native';
import { PackTemplateItemImage } from '../components/PackTemplateItemImage';
import { usePackTemplateItem } from '../hooks/usePackTemplateItem';

export function PackTemplateItemDetailScreen() {
  const { colors } = useColorScheme();
  const { t } = useTranslation();

  const { id } = useLocalSearchParams<{ id: string }>();

  const item = usePackTemplateItem(id as string);

  assertDefined(item);

  const weightUnit = item.weightUnit;
  const totalWeight = calculateTotalWeight(item);
  const quantity = getQuantity(item);
  const isItemConsumable = isConsumable(item);
  const showQuantity = shouldShowQuantity(item);
  const isItemWorn = isWorn(item);
  const itemHasNotes = hasNotes(item);
  const itemNotes = getNotes(item);

  const navigateToChat = () => {
    if (!isAuthed.peek()) {
      return router.push({
        pathname: '/auth',
        params: {
          redirectTo: JSON.stringify({
            pathname: '/ai-chat',
            params: {
              itemId: item.id,
              itemName: item.name,
              contextType: 'templateItem',
            },
          }),
          showSignInCopy: 'true',
        },
      });
    }

    router.push({
      pathname: '/ai-chat',
      params: {
        itemId: item.id,
        itemName: item.name,
        contextType: 'templateItem',
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView>
        <PackTemplateItemImage item={item} className="h-64 w-full" resizeMode="cover" />

        <View className="mb-4 p-4">
          <Text className="mb-1 text-2xl font-bold text-foreground">{item.name}</Text>
          <Text className="mb-3 text-muted-foreground">{item.category}</Text>

          {item.description && (
            <Text className="mb-4 text-muted-foreground">{item.description}</Text>
          )}

          <View className="mb-4 flex-row justify-between">
            <View>
              <Text className="mb-1 text-xs uppercase text-muted-foreground">{t('packTemplates.weightEach')}</Text>
              <WeightBadge weight={item.weight} unit={weightUnit} />
            </View>

            {showQuantity && (
              <View>
                <Text className="mb-1 text-xs uppercase text-muted-foreground">{t('packTemplates.quantity')}</Text>
                <Chip textClassName="text-center text-xs" variant="secondary">
                  {quantity}
                </Chip>
              </View>
            )}

            {showQuantity && (
              <View>
                <Text className="mb-1 text-xs uppercase text-muted-foreground">{t('packTemplates.totalWeight')}</Text>
                <WeightBadge weight={totalWeight} unit={weightUnit} />
              </View>
            )}
          </View>

          <View className="mb-4 flex-row gap-3">
            {isItemConsumable && (
              <View className="flex-row items-center">
                <Chip textClassName="text-center text-xs" variant="consumable">
                  {t('packTemplates.consumable')}
                </Chip>
              </View>
            )}

            {isItemWorn && (
              <View className="flex-row items-center">
                <Chip textClassName="text-center text-xs" variant="worn">
                  {t('packTemplates.worn')}
                </Chip>
              </View>
            )}
          </View>

          {itemHasNotes && (
            <View className="mt-2">
              <Text className="mb-1 text-xs text-muted-foreground">{t('packTemplates.notes')}</Text>
              <Text className="text-foreground">{itemNotes}</Text>
            </View>
          )}
        </View>

        <View className="pb-16 mt-4 px-4">
          <Button
            variant="secondary"
            onPress={navigateToChat}
            className="flex-row items-center justify-center rounded-full px-4 py-3"
          >
            <Icon name="message-outline" size={20} color={colors.foreground} />
            <Text className="ml-2 font-semibold">{t('packTemplates.askAIAboutItem')}</Text>
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
