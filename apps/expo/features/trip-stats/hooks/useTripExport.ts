import * as Sentry from '@sentry/react-native';
import * as Burnt from 'burnt';
import { useTrips } from 'expo-app/features/trips/hooks';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Directory } from 'expo-file-system';
import { Alert } from 'react-native';
import { exportableTrips, exportFileName, tripsCsv, tripsGpx } from '../utils/tripExport';
import { useDistanceUnit } from './useDistanceUnit';

export type ExportKind = 'csv' | 'gpx';

const MIME_TYPES = Object.freeze({ csv: 'text/csv', gpx: 'application/gpx+xml' } as const);
const CANCELLED = /cancel/i;

/**
 * Saves every finished trip as a spreadsheet, or every route as GPX, into a folder the user picks
 * with the system's document picker (Storage Access Framework), Android's "save as".
 */
export function useTripExport() {
  const { t } = useTranslation();
  const trips = useTrips();
  const unit = useDistanceUnit();

  return async (kind: ExportKind) => {
    const now = new Date();
    const finished = exportableTrips({ trips, now });
    const contents =
      kind === 'csv'
        ? tripsCsv({
            trips: finished,
            unit,
            activityLabel: (activity) => t(`tripStats.activities.names.${activity}`),
          })
        : tripsGpx(finished);
    if (contents == null) {
      Alert.alert(t('tripStats.export.noRoutes'));
      return;
    }
    const name = exportFileName({
      base: kind === 'csv' ? t('tripStats.export.csvName') : t('tripStats.export.gpxName'),
      extension: kind,
      now,
    });
    Sentry.addBreadcrumb({
      category: 'tripStats',
      message: 'Export trips',
      level: 'info',
      data: { kind, trips: finished.length },
    });
    try {
      const folder = await Directory.pickDirectoryAsync();
      const file = folder.createFile(name, MIME_TYPES[kind]);
      await file.write(contents);
      Burnt.toast({ title: t('tripStats.export.saved', { name }), preset: 'done' });
    } catch (error) {
      if (error instanceof Error && CANCELLED.test(error.message)) return;
      Sentry.captureException(error, {
        tags: { feature: 'tripStats', action: 'exportTrips' },
        extra: { kind, trips: finished.length },
      });
      Alert.alert(t('tripStats.export.failed'));
    }
  };
}
