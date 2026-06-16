import type { AlertMethods } from '@packrat/ui/nativewindui';
import { Alert, ListItem, Text } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import { SearchInput } from 'expo-app/components/SearchInput';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePacks } from '../hooks';
import type { PackInStore } from '../types';

const CATEGORY_ICONS: Record<string, string> = {
  hiking: 'walk',
  backpacking: 'bag-personal',
  camping: 'tent',
  climbing: 'image-filter-hdr',
  winter: 'snowflake',
  skiing: 'ski',
  'water sports': 'waves',
  desert: 'weather-sunny',
  custom: 'cog',
};

export function PackStatsTile() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();

  const packs = usePacks();
  const alertRef = useRef<AlertMethods>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [query, setQuery] = useState('');

  const filteredPacks = query.trim()
    ? packs.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : packs;

  const handlePress = () => {
    if (packs.length === 0) {
      alertRef.current?.show();
      return;
    }
    if (packs.length === 1) {
      const only = packs[0];
      if (only) router.push(`/pack-stats/${only.id}`);
      return;
    }
    setQuery('');
    setPickerVisible(true);
  };

  const handlePickPack = (pack: PackInStore) => {
    setPickerVisible(false);
    router.push(`/pack-stats/${pack.id}`);
  };

  return (
    <>
      <ListItem
        className="ios:pl-0 pl-2"
        titleClassName="text-lg"
        leftView={
          <View className="px-3">
            <View className="h-6 w-6 items-center justify-center rounded-md bg-blue-500">
              <Icon name="chart-pie" size={15} color="white" />
            </View>
          </View>
        }
        rightView={
          <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
            <ChevronRight />
          </View>
        }
        item={{ title: t('packs.packStats') }}
        onPress={handlePress}
        target="Cell"
        index={0}
        removeSeparator={Platform.OS === 'ios'}
      />

      <Alert
        title={t('packs.noPacksYet')}
        message={t('packs.createPackForStats')}
        materialIcon={{ name: 'information-outline' }}
        materialWidth={370}
        buttons={[{ text: t('packs.gotIt'), style: 'default' }]}
        ref={alertRef}
      />

      <Modal
        visible={pickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerVisible(false)}
      >
        <SafeAreaView className="flex-1 bg-background">
          {/* Header */}
          <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
            <TouchableOpacity onPress={() => setPickerVisible(false)}>
              <Icon name="close" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text className="text-lg font-semibold">{t('packs.selectPack')}</Text>
          </View>

          {/* Search bar */}
          <View className="border-b border-border px-4 py-2">
            <SearchInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('packs.searchPacks')}
              autoCorrect={false}
            />
          </View>

          {/* Pack list */}
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            {filteredPacks.length === 0 ? (
              <View className="items-center py-12">
                <Text className="text-muted-foreground">{t('packs.noPacksFound')}</Text>
              </View>
            ) : (
              filteredPacks.map((pack) => {
                const icon = CATEGORY_ICONS[pack.category] ?? 'bag-personal';
                return (
                  <Pressable
                    key={pack.id}
                    onPress={() => handlePickPack(pack)}
                    className="flex-row items-center rounded-xl border border-border bg-card p-4"
                    style={({ pressed }) => (pressed ? { opacity: 0.7 } : {})}
                  >
                    <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                      <Icon name={icon} size={20} color={colors.primary} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold">{pack.name}</Text>
                      {pack.category ? (
                        <Text variant="footnote" className="capitalize text-muted-foreground">
                          {pack.category}
                        </Text>
                      ) : null}
                    </View>
                    <Icon name="chevron-right" size={16} color={colors.grey} />
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <View style={{ height: insets.bottom }} />
        </SafeAreaView>
      </Modal>
    </>
  );
}

function ChevronRight() {
  const { colors } = useColorScheme();
  return <Icon name="chevron-right" size={17} color={colors.grey} />;
}
