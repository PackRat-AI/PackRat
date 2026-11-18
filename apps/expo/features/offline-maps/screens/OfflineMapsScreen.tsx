import { use$ } from '@legendapp/state/react';
import { isString } from '@packrat/guards';
import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { Button } from '@packrat/ui/src/button';
import { createDropdownItem, DropdownMenu } from '@packrat/ui/src/dropdown-menu';
import { Text } from '@packrat/ui/src/text';
import { Toggle } from '@packrat/ui/src/toggle';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useRouter } from 'expo-router';
import { useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { failureText, ProgressLine, WaitingLine } from '../components/DownloadStatus';
import { useDownloadState, useOfflineAreas } from '../hooks/useOfflineAreas';
import {
  cancelArea,
  deleteAllAreas,
  deleteArea,
  renameArea,
  updateArea,
} from '../lib/offlineMapManager';
import { offlineMapsStore } from '../store/offlineMaps';
import type { OfflineArea } from '../types';
import { formatBytes, totalBytes, tripHasEnded } from '../utils/offlineArea';

/** Settings › Offline maps: every saved area, the space they take, and the download settings. */
export function OfflineMapsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const areas = useOfflineAreas();
  const allowCellular = use$(offlineMapsStore.allowCellular);
  const alertRef = useRef<AlertMethods>(null);

  const addArea = () => router.push('/offline-maps/pick');

  const rename = (area: OfflineArea) =>
    alertRef.current?.prompt({
      title: t('offlineMaps.renameTitle'),
      prompt: { type: 'plain-text', defaultValue: area.name },
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.save'),
          onPress: (value) => {
            if (isString(value)) renameArea({ id: area.id, name: value });
          },
        },
      ],
    });

  const confirmDeleteAll = () =>
    alertRef.current?.alert({
      title: t('offlineMaps.deleteAllTitle'),
      message: t('offlineMaps.deleteAllMessage'),
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('offlineMaps.deleteAllConfirm'),
          style: 'destructive',
          onPress: () => void deleteAllAreas(),
        },
      ],
    });

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={addArea}
              hitSlop={8}
              className="p-2"
              accessibilityRole="button"
              accessibilityLabel={t('offlineMaps.saveArea')}
              testID={testIds.offlineMaps.add}
            >
              <Icon name="plus" size={24} color={colors.foreground} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerClassName="p-4 pb-10 gap-6">
        {areas.length === 0 ? (
          <View className="items-center gap-3 px-6 pt-10">
            <Icon name="map-outline" size={56} color={colors.primary} />
            <Text variant="title3" className="text-center font-semibold">
              {t('offlineMaps.emptyTitle')}
            </Text>
            <Text variant="callout" className="text-center text-muted-foreground" wrap>
              {t('offlineMaps.emptyBody')}
            </Text>
            <Button
              variant="filled"
              icon="download-outline"
              className="mt-2"
              onPress={addArea}
              testID={testIds.offlineMaps.emptyAdd}
            >
              <Text>{t('offlineMaps.saveArea')}</Text>
            </Button>
          </View>
        ) : (
          <View className="gap-2">
            <Text variant="subhead">{t('offlineMaps.savedAreas')}</Text>
            <View className="overflow-hidden rounded-xl border border-border bg-card">
              {areas.map((area, index) => (
                <AreaRow
                  key={area.id}
                  area={area}
                  divided={index > 0}
                  onOpen={() => router.push(`/offline-maps/${area.id}`)}
                  onRename={() => rename(area)}
                />
              ))}
            </View>
            <Text variant="footnote" className="px-1 text-muted-foreground">
              {t('offlineMaps.used', { size: formatBytes(totalBytes(areas)) })}
            </Text>
            <Button
              variant="plain"
              className="self-start"
              onPress={confirmDeleteAll}
              testID={testIds.offlineMaps.deleteAll}
            >
              <Text className="text-destructive">{t('offlineMaps.deleteAll')}</Text>
            </Button>
          </View>
        )}

        <View className="gap-2">
          <Text variant="subhead">{t('offlineMaps.downloads')}</Text>
          <View className="rounded-xl border border-border bg-card">
            <View className="flex-row items-center justify-between gap-4 p-4">
              <View className="flex-1">
                <Text className="font-medium">{t('offlineMaps.allowCellular')}</Text>
                <Text variant="footnote" className="mt-0.5 text-muted-foreground" wrap>
                  {t('offlineMaps.allowCellularSubtitle')}
                </Text>
              </View>
              <Toggle
                value={allowCellular}
                onValueChange={(on) => offlineMapsStore.allowCellular.set(on)}
                testID={testIds.offlineMaps.allowCellular}
              />
            </View>
          </View>
        </View>
      </ScrollView>
      <Alert title="" buttons={[]} ref={alertRef} />
    </SafeAreaView>
  );
}

/**
 * One saved area. A finished area opens its map; one still downloading keeps its Cancel and Try
 * again buttons instead.
 */
function AreaRow({
  area,
  divided,
  onOpen,
  onRename,
}: {
  area: OfflineArea;
  divided: boolean;
  onOpen: () => void;
  onRename: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useColorScheme();
  const { progress, failure, waiting } = useDownloadState(area.id);
  const busy = progress !== undefined || waiting;
  const opens = area.isComplete && !busy && failure === undefined;
  const detailLabel = area.detail === 'trail' ? t('offlineMaps.trail') : t('offlineMaps.standard');
  const details = [
    formatBytes(area.sizeBytes),
    detailLabel,
    new Date(area.savedAt).toLocaleDateString(i18n.language, { dateStyle: 'medium' }),
  ].join(' · ');

  return (
    <Pressable
      onPress={opens ? onOpen : undefined}
      disabled={!opens}
      android_ripple={opens ? { color: colors.grey5 } : undefined}
      className={`min-h-16 flex-row items-center gap-3 py-3 pl-4 pr-1 ${
        divided ? 'border-t border-border' : ''
      }`}
      testID={testIds.offlineMaps.areaRow(area.id)}
    >
      <View className="flex-1 gap-1">
        <Text variant="body" className="font-semibold">
          {area.name}
        </Text>
        {progress ? (
          <ProgressLine progress={progress} t={t} />
        ) : waiting ? (
          <WaitingLine t={t} />
        ) : failure ? (
          <Text variant="caption1" className="text-destructive" wrap>
            {failureText({ area, failure, t })}
          </Text>
        ) : (
          <Text variant="caption1" className="text-muted-foreground">
            {details}
          </Text>
        )}
        {tripHasEnded(area, Date.now()) ? (
          <View className="flex-row items-center gap-1">
            <Icon name="flag-checkered" size={14} color={colors.primary} />
            <Text variant="caption1" className="text-primary">
              {t('offlineMaps.tripFinished')}
            </Text>
          </View>
        ) : null}
      </View>
      {busy ? (
        <Button variant="plain" onPress={() => void cancelArea(area)}>
          <Text className="text-primary">{t('offlineMaps.cancelDownload')}</Text>
        </Button>
      ) : failure && failure !== 'tooLarge' ? (
        // Trying a too-large area again fails the same way.
        <Button variant="plain" onPress={() => void updateArea(area)}>
          <Text className="text-primary">{t('offlineMaps.tryAgain')}</Text>
        </Button>
      ) : null}
      <DropdownMenu
        items={[
          createDropdownItem({ actionKey: 'rename', title: t('offlineMaps.rename') }),
          ...(opens
            ? [createDropdownItem({ actionKey: 'update', title: t('offlineMaps.update') })]
            : []),
          createDropdownItem({
            actionKey: 'delete',
            title: t('offlineMaps.delete'),
            destructive: true,
          }),
        ]}
        onItemPress={(item) => {
          if (item.actionKey === 'rename') onRename();
          else if (item.actionKey === 'update') void updateArea(area);
          else if (item.actionKey === 'delete') void deleteArea(area);
        }}
      >
        <View
          className="h-10 w-10 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={t('offlineMaps.options', { name: area.name })}
        >
          <Icon name="dots-vertical" size={22} color={colors.grey} />
        </View>
      </DropdownMenu>
    </Pressable>
  );
}
