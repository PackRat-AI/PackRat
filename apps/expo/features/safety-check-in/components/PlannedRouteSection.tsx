import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { Button } from '@packrat/ui/src/button';
import { Card } from '@packrat/ui/src/card';
import { createDropdownItem, DropdownMenu } from '@packrat/ui/src/dropdown-menu';
import { Text } from '@packrat/ui/src/text';
import * as Sentry from '@sentry/react-native';
import { Icon } from 'expo-app/components/Icon';
import { useDistanceUnit } from 'expo-app/features/trip-stats/hooks/useDistanceUnit';
import { GpxParseError } from 'expo-app/features/trip-stats/utils/trackGeometry';
import { formatDistance } from 'expo-app/features/trip-stats/utils/units';
import { tripsStore } from 'expo-app/features/trips/store/trips';
import type { Trip } from 'expo-app/features/trips/types';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { obs } from 'expo-app/lib/store';
import { testIds } from 'expo-app/lib/testIds';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRef } from 'react';
import { View } from 'react-native';
import { plannedRouteFromGpx, plannedRouteLength } from '../utils/plannedRoute';

/** Reads the trip fresh, since the file picker can stay open while the trip changes underneath. */
function setPlannedRoute({ tripId, route }: { tripId: string; route: Trip['plannedRoute'] }) {
  const trip = obs({ store: tripsStore, id: tripId });
  const current = trip.peek();
  if (!current) return;
  trip.set({ ...current, plannedRoute: route, localUpdatedAt: new Date().toISOString() });
}

/**
 * A trip's planned route: import a GPX track, see its length, replace or remove it. With a route,
 * a safety check-in tells the contacts if the user strays well off it.
 */
export function PlannedRouteSection({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const unit = useDistanceUnit();
  const alertRef = useRef<AlertMethods>(null);
  const route = trip.plannedRoute && trip.plannedRoute.length >= 2 ? trip.plannedRoute : null;

  const importRoute = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/gpx+xml', 'application/xml', 'text/xml', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      const parsed = plannedRouteFromGpx(await FileSystem.readAsStringAsync(asset.uri));
      setPlannedRoute({ tripId: trip.id, route: parsed });
    } catch (error) {
      if (!(error instanceof GpxParseError)) {
        Sentry.captureException(error, {
          tags: { feature: 'safetyCheckIn', action: 'importRoute' },
          extra: { tripId: trip.id },
        });
      }
      alertRef.current?.alert({
        title: t('safetyCheckIn.route.importFailed'),
        message:
          error instanceof GpxParseError
            ? t('safetyCheckIn.route.noTrack')
            : t('safetyCheckIn.route.unreadable'),
        buttons: [{ text: t('common.ok'), style: 'default' }],
      });
    }
  };

  return (
    <View className="mb-6">
      <Text className="mb-2 text-lg font-semibold text-foreground">
        {t('safetyCheckIn.route.title')}
      </Text>
      {route ? (
        <Card className="flex-row items-center gap-3 p-4">
          <Icon name="map-marker-path" size={24} color={colors.primary} />
          <View className="flex-1 gap-0.5">
            <Text variant="callout" className="font-semibold">
              {t('safetyCheckIn.route.length', {
                distance: formatDistance({ metres: plannedRouteLength(route), unit }),
              })}
            </Text>
            <Text variant="footnote" className="text-muted-foreground" wrap>
              {t('safetyCheckIn.route.caption')}
            </Text>
          </View>
          <DropdownMenu
            items={[
              createDropdownItem({ actionKey: 'replace', title: t('safetyCheckIn.route.replace') }),
              createDropdownItem({
                actionKey: 'remove',
                title: t('safetyCheckIn.route.remove'),
                destructive: true,
              }),
            ]}
            onItemPress={(item) => {
              if (item.actionKey === 'replace') void importRoute();
              else if (item.actionKey === 'remove')
                setPlannedRoute({ tripId: trip.id, route: null });
            }}
          >
            <View
              className="h-10 w-10 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel={t('safetyCheckIn.route.options')}
              testID={testIds.safetyCheckIn.routeMenuBtn}
            >
              <Icon name="dots-vertical" size={22} color={colors.grey} />
            </View>
          </DropdownMenu>
        </Card>
      ) : (
        <Button
          variant="outlined"
          className="gap-2 self-start"
          onPress={importRoute}
          testID={testIds.safetyCheckIn.importRouteBtn}
        >
          <Icon name="file-import-outline" size={18} color={colors.primary} />
          <Text className="font-medium text-primary">{t('safetyCheckIn.route.import')}</Text>
        </Button>
      )}
      <Alert title="" buttons={[]} ref={alertRef} />
    </View>
  );
}
