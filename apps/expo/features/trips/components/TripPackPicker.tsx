import { Text } from '@packrat/ui/src/text';
import { TextField } from '@packrat/ui/src/text-field';
import { Icon } from 'expo-app/components/Icon';
import { useWeightUnit } from 'expo-app/features/auth/hooks/useWeightUnit';
import type { Pack } from 'expo-app/features/packs/types';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** "24 items · 9.2 lb" for a pack row. */
export function usePackSummary() {
  const { t } = useTranslation();
  const { unit, convertWeight } = useWeightUnit();
  return (pack: Pack) => {
    const count = pack.items?.length ?? 0;
    const items = t('trips.form.items', { count });
    if (!pack.totalWeight) return items;
    return `${items} · ${convertWeight({ weight: pack.totalWeight, fromUnit: 'g' })} ${unit}`;
  };
}

interface TripPackPickerProps {
  visible: boolean;
  packs: Pack[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onNewPack: () => void;
  onClose: () => void;
}

/**
 * A full-screen Material 3 dialog listing every pack with its size and weight. Picking a row
 * chooses it and closes; None unlinks the pack.
 */
export function TripPackPicker({
  visible,
  packs,
  selectedId,
  onSelect,
  onNewPack,
  onClose,
}: TripPackPickerProps) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const summary = usePackSummary();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return packs;
    return packs.filter((pack) => pack.name.toLowerCase().includes(q));
  }, [packs, query]);

  const choose = (id: string | null) => {
    onSelect(id);
    setQuery('');
    onClose();
  };

  const row = ({
    id,
    title,
    supporting,
    icon,
  }: {
    id: string | null;
    title: string;
    supporting: string | null;
    icon: 'bag-personal' | 'close-circle-outline';
  }) => {
    const selected = selectedId === id;
    return (
      <Pressable
        onPress={() => choose(id)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        testID={id ? testIds.trips.packOption(id) : testIds.trips.packNone}
        android_ripple={{ color: colors.grey4 }}
        className="min-h-16 flex-row items-center gap-4 px-4 py-3"
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-card border border-border">
          <Icon name={icon} size={22} color={id ? colors.primary : colors.grey} />
        </View>
        <View className="flex-1">
          <Text variant="body" numberOfLines={1}>
            {title}
          </Text>
          {supporting ? (
            <Text variant="subhead" className="text-muted-foreground" numberOfLines={1}>
              {supporting}
            </Text>
          ) : null}
        </View>
        <View
          className="h-5 w-5 items-center justify-center rounded-full border-2"
          style={{ borderColor: selected ? colors.primary : colors.grey }}
        >
          {selected ? (
            <View
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colors.primary }}
            />
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background" testID={testIds.trips.packPicker}>
        <View className="h-16 flex-row items-center gap-1 px-1">
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            android_ripple={{ color: colors.grey4, borderless: true, radius: 22 }}
            className="h-12 w-12 items-center justify-center"
          >
            <Icon name="close" size={24} color={colors.foreground} />
          </Pressable>
          <Text variant="title3" className="flex-1">
            {t('trips.form.choosePack')}
          </Text>
        </View>

        {packs.length > 5 ? (
          <View className="px-4 pb-2">
            <TextField
              placeholder={t('trips.form.searchPacks')}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
          </View>
        ) : null}

        <FlatList
          data={filtered}
          keyExtractor={(pack) => pack.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              <Pressable
                onPress={() => {
                  setQuery('');
                  onNewPack();
                }}
                accessibilityRole="button"
                testID={testIds.trips.packNew}
                android_ripple={{ color: colors.grey4 }}
                className="min-h-14 flex-row items-center gap-4 px-4 py-3"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-primary">
                  <Icon name="plus" size={22} color="white" />
                </View>
                <Text variant="body" className="font-medium text-primary">
                  {t('trips.form.newPack')}
                </Text>
              </Pressable>
              {query.trim()
                ? null
                : row({
                    id: null,
                    title: t('trips.form.noPack'),
                    supporting: null,
                    icon: 'close-circle-outline',
                  })}
            </View>
          }
          renderItem={({ item }) =>
            row({ id: item.id, title: item.name, supporting: summary(item), icon: 'bag-personal' })
          }
          ListEmptyComponent={
            query.trim() ? (
              <Text variant="subhead" className="px-4 py-6 text-center text-muted-foreground">
                {t('trips.form.noPacksMatch')}
              </Text>
            ) : undefined
          }
        />
      </SafeAreaView>
    </Modal>
  );
}
