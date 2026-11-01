import { FilterChip, FlowRow, Host, Text as JCText } from '@expo/ui/jetpack-compose';
import { testID as testIDModifier } from '@expo/ui/jetpack-compose/modifiers';
import { assertDefined } from '@packrat/guards';
import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { TextField } from '@packrat/ui/src/text-field';
import { Toggle } from '@packrat/ui/src/toggle';
import { displayWeight, normalize, parseWeightUnit } from '@packrat/units';
import { useQueryClient } from '@tanstack/react-query';
import * as Burnt from 'burnt';
import { Icon } from 'expo-app/components/Icon';
import { TextInput } from 'expo-app/components/TextInput';
import { useWeightUnit } from 'expo-app/features/auth/hooks/useWeightUnit';
import { useCreatePackItem, usePackDetailsFromStore } from 'expo-app/features/packs';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { ErrorScreen } from 'expo-app/screens/ErrorScreen';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, type TextInputInstance, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CatalogItemImage } from '../components/CatalogItemImage';
import { useCatalogItemDetails } from '../hooks';
import { cacheCatalogItemImage } from '../lib/cacheCatalogItemImage';
import type { CatalogItem } from '../types';

export function AddCatalogItemDetailsScreen() {
  const router = useRouter();
  const { catalogItemId, packId } = useLocalSearchParams();
  const {
    data: catalogItem,
    isLoading: isLoadingItem,
    isError,
    refetch,
  } = useCatalogItemDetails(catalogItemId as string);
  const pack = usePackDetailsFromStore(packId as string);
  const createItem = useCreatePackItem();
  const queryClient = useQueryClient();
  const { unit: preferredWeightUnit, convertWeight } = useWeightUnit();
  const [isAdding, setIsAdding] = useState(false);
  const { t } = useTranslation();

  // Form state
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [isConsumable, setIsConsumable] = useState(false);
  const [isWorn, setIsWorn] = useState(false);
  const [category, setCategory] = useState('');

  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();
  const notesRef = useRef<TextInputInstance>(null);
  const quantityValue = Math.max(1, Number.parseInt(quantity, 10) || 1);

  const contentContainerStyle = useMemo(
    () => ({ paddingBottom: insets.bottom + 24 }),
    [insets.bottom],
  );

  // The catalog's own categories first, then the ones already in this pack, so picking a
  // familiar group is one tap and typing is the exception rather than the rule.
  const categorySuggestions = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of [
      ...(catalogItem?.categories ?? []),
      ...pack.items.map((item) => item.category),
    ]) {
      const value = raw?.trim();
      if (!value || seen.has(value.toLowerCase())) continue;
      seen.add(value.toLowerCase());
      result.push(value);
    }
    return result.slice(0, 8);
  }, [catalogItem?.categories, pack.items]);

  // Reset form when catalog item changes
  useEffect(() => {
    if (catalogItem) {
      setQuantity('1');
      setNotes('');
      setIsConsumable(false);
      setIsWorn(false);
      setCategory(catalogItem.categories?.[0] ?? '');
    }
  }, [catalogItem]);

  const handleAddToPack = async () => {
    setIsAdding(true);
    assertDefined(catalogItem);

    const cachedImageFilename = await cacheCatalogItemImage(catalogItem.images?.[0]);

    createItem({
      packId: packId as string,
      itemData: {
        name: catalogItem.name,
        description: catalogItem.description ?? undefined,
        weight: displayWeight({
          grams: normalize({
            weight: catalogItem.weight || 0,
            unit: parseWeightUnit({ value: catalogItem.weightUnit }),
          }),
          unit: preferredWeightUnit,
        }),
        weightUnit: preferredWeightUnit,
        quantity: quantityValue,
        category: category.trim(),
        consumable: isConsumable,
        worn: isWorn,
        notes,
        image: cachedImageFilename,
        catalogItemId: catalogItem.id,
      },
    });
    // Increment catalog item usage count
    queryClient.setQueryData(['catalogItem', catalogItemId], (oldData: CatalogItem) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        usageCount: (oldData.usageCount || 0) + 1,
      };
    });
    setIsAdding(false);
    Burnt.toast({
      title: t('catalog.itemAdded'),
      preset: 'done',
    });
    // Navigate back to the catalog item detail screen
    router.dismissTo({
      pathname: '/catalog/[id]',
      params: { id: catalogItemId as string },
    });
  };

  if (isLoadingItem) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <ErrorScreen
        title={t('catalog.errorFetchingItem')}
        message={t('catalog.pleaseTryAgain')}
        onRetry={refetch}
        variant="destructive"
      />
    );
  }

  assertDefined(catalogItem);

  return (
    <KeyboardAwareScrollView
      bottomOffset={16}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      className="flex-1 bg-background"
      contentContainerStyle={contentContainerStyle}
    >
      <View className="border-b border-border bg-card px-4 py-3">
        <View className="flex-row items-center">
          <CatalogItemImage
            imageUrl={catalogItem.images?.[0]}
            className="h-24 w-24 rounded-md"
            resizeMode="cover"
          />
          <View className="ml-3 flex-1">
            <Text className="text-xs uppercase text-muted-foreground">{t('catalog.adding')}</Text>
            <Text variant="title3" color="primary">
              {catalogItem.name}
            </Text>
            <View className="mt-1 flex-row items-center">
              <Icon name="dumbbell" size={14} color={colors.grey2} />
              <Text variant="caption2" className="ml-1">
                {catalogItem.weight != null
                  ? `${convertWeight({ weight: catalogItem.weight, fromUnit: catalogItem.weightUnit ?? 'g' })} ${preferredWeightUnit}`
                  : ''}
              </Text>
              {catalogItem.brand && (
                <>
                  <View className="mx-1 h-1 w-1 rounded-full bg-muted-foreground" />
                  <Text variant="caption2">{catalogItem.brand}</Text>
                </>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Selected Pack */}
      <View className="flex-row items-center gap-4 border-b border-border bg-card px-4 py-3">
        <Icon name="basket-outline" size={24} color={colors.grey} />
        <View className="flex-1">
          <Text className="text-xs text-muted-foreground">{t('catalog.selectedPack')}</Text>
          <Text className="text-base font-medium text-foreground">{pack.name}</Text>
          <Text className="text-xs capitalize text-muted-foreground">
            {pack.items.length} {pack.items.length === 1 ? t('catalog.item') : t('catalog.items')}
            {pack.category ? ` · ${pack.category}` : ''}
          </Text>
        </View>
      </View>

      {/* Item Details Form */}
      <View className="gap-6 px-4 pt-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-base text-foreground">{t('catalog.quantity')}</Text>
          <View className="flex-row items-center gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('catalog.decreaseQuantity')}
              disabled={quantityValue <= 1}
              className="h-12 w-12 items-center justify-center rounded-full border border-border active:bg-muted disabled:opacity-40"
              onPress={() => setQuantity(String(Math.max(1, quantityValue - 1)))}
            >
              <Icon name="minus" size={20} color={colors.foreground} />
            </Pressable>
            <TextInput
              testID={testIds.catalog.addDetailsQuantityInput}
              accessibilityLabel={t('catalog.quantity')}
              className="w-12 text-center text-lg font-medium text-foreground"
              value={quantity}
              onChangeText={(text) =>
                setQuantity([...text].filter((char) => char >= '0' && char <= '9').join(''))
              }
              onBlur={() => setQuantity(String(quantityValue))}
              keyboardType="number-pad"
              selectTextOnFocus
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('catalog.increaseQuantity')}
              className="h-12 w-12 items-center justify-center rounded-full border border-border active:bg-muted"
              onPress={() => setQuantity(String(quantityValue + 1))}
            >
              <Icon name="plus" size={20} color={colors.foreground} />
            </Pressable>
          </View>
        </View>

        <View className="gap-3">
          <TextField
            testID={testIds.catalog.addDetailsCategoryInput}
            label={t('catalog.category')}
            placeholder={t('catalog.categoryPlaceholder')}
            value={category}
            onChangeText={setCategory}
            autoCapitalize="words"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => notesRef.current?.focus()}
          />
          {categorySuggestions.length > 0 && (
            <Host matchContents={{ vertical: true, horizontal: false }} style={{ width: '100%' }}>
              <FlowRow
                horizontalArrangement={{ spacedBy: 8 }}
                verticalArrangement={{ spacedBy: 8 }}
              >
                {categorySuggestions.map((suggestion) => (
                  <FilterChip
                    key={suggestion}
                    selected={suggestion.toLowerCase() === category.trim().toLowerCase()}
                    onClick={() => setCategory(suggestion)}
                    modifiers={[testIDModifier(testIds.catalog.addDetailsCategoryChip(suggestion))]}
                    colors={{
                      selectedContainerColor: colors.primary,
                      selectedLabelColor: '#FFFFFF',
                      selectedLeadingIconColor: '#FFFFFF',
                      labelColor: colors.foreground,
                    }}
                  >
                    <FilterChip.Label>
                      <JCText>{suggestion}</JCText>
                    </FilterChip.Label>
                  </FilterChip>
                ))}
              </FlowRow>
            </Host>
          )}
        </View>

        <TextField
          ref={notesRef}
          label={t('catalog.notes')}
          placeholder={t('catalog.notesPlaceholder')}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        <View>
          <View className="min-h-[72px] flex-row items-center justify-between gap-4 py-2">
            <View className="flex-1">
              <Text className="text-base text-foreground">{t('catalog.consumable')}</Text>
              <Text className="text-sm text-muted-foreground">
                {t('catalog.consumableDescription')}
              </Text>
            </View>
            <Toggle value={isConsumable} onValueChange={setIsConsumable} />
          </View>
          <View className="min-h-[72px] flex-row items-center justify-between gap-4 py-2">
            <View className="flex-1">
              <Text className="text-base text-foreground">{t('catalog.worn')}</Text>
              <Text className="text-sm text-muted-foreground">{t('catalog.wornDescription')}</Text>
            </View>
            <Toggle value={isWorn} onValueChange={setIsWorn} />
          </View>
        </View>

        <View className="gap-2">
          <Button
            testID={testIds.items.catalogConfirmAddBtn}
            onPress={handleAddToPack}
            disabled={isAdding}
          >
            {isAdding ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text>{t('catalog.addToPack')}</Text>
            )}
          </Button>
          <Button variant="text" onPress={() => router.back()} disabled={isAdding}>
            <Text>{t('catalog.cancel')}</Text>
          </Button>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
