import * as Sentry from '@sentry/react-native';
import { uploadImage } from 'expo-app/features/packs/utils';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { nanoid } from 'nanoid';
import { useCallback, useState } from 'react';
import type { OverallCondition, TrailSurface } from '../types';
import type { ReportPlace } from '../utils/trails';
import { useReportLocation } from './useReportLocation';
import { useSubmitTrailConditionReport } from './useTrailConditions';

/** The most photos a report carries, matching the server's limit. */
export const MAX_REPORT_PHOTOS = 5;

interface UseTrailConditionFormOptions {
  tripId?: string;
  /** The trail the report starts on, when opened from a trail page or a trip. */
  initialPlace?: ReportPlace | null;
  /** Called with whether the report went straight up or waits in the outbox. */
  onSubmitted: (result: { queued: boolean }) => void;
}

/**
 * Form state for a new trail condition report.
 *
 * Lifted out of the form component because the Submit and Cancel actions live in the native
 * navigation header — rendered by the navigator, outside the form's tree — and so cannot reach
 * the state through it. Mirrors `SubmitTrailConditionView`'s `@State` block and its toolbar
 * `Submit` button, which sit in the same view in SwiftUI.
 */
export function useTrailConditionForm({
  tripId,
  initialPlace = null,
  onSubmitted,
}: UseTrailConditionFormOptions) {
  const { mutateAsync: submitReport, isPending } = useSubmitTrailConditionReport();
  const location = useReportLocation();
  const { t } = useTranslation();

  const [place, setPlace] = useState<ReportPlace | null>(initialPlace);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ completed: number; total: number } | null>(
    null,
  );
  const [condition, setCondition] = useState<OverallCondition>('good');
  const [surface, setSurface] = useState<TrailSurface>('dirt');
  const [hazards, setHazards] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // A report is about a picked trail or a dropped pin; nothing else is required.
  const isValid = place !== null;

  const addPhotos = useCallback((uris: string[]) => {
    setPhotoUris((current) => [...current, ...uris].slice(0, MAX_REPORT_PHOTOS));
  }, []);

  const removePhoto = useCallback((uri: string) => {
    setPhotoUris((current) => current.filter((existing) => existing !== uri));
  }, []);

  const submit = useCallback(async () => {
    if (!place || isPending) return;
    setError(null);
    Sentry.addBreadcrumb({
      category: 'trailConditions',
      message: 'Submitting trail condition report',
      level: 'info',
      data: {
        hazardCount: hazards.length,
        overallCondition: condition,
        surface,
        placeKind: place.kind,
        photoCount: photoUris.length,
      },
    });
    const batch = nanoid(8);
    let completed = 0;
    try {
      const result = await submitReport({
        place,
        writtenFrom: location.coordinate,
        surface,
        overallCondition: condition,
        hazards,
        notes: notes.trim() || null,
        tripId: tripId ?? null,
        photoUris,
        upload: async ({ uri, index }) => {
          setUploadProgress({ completed, total: photoUris.length });
          const key = await uploadImage({ fileName: `trail-report-${batch}-${index}.jpg`, uri });
          if (!key) throw new Error('Photo upload returned no key');
          completed += 1;
          setUploadProgress({ completed, total: photoUris.length });
          return key;
        },
      });
      onSubmitted(result);
    } catch {
      // The service already reported to Sentry with request context. Only a report the server
      // rejects outright gets here; a retryable failure was queued instead.
      setError(t('trailConditions.submitRejected'));
    } finally {
      setUploadProgress(null);
    }
  }, [
    condition,
    hazards,
    isPending,
    location.coordinate,
    notes,
    onSubmitted,
    photoUris,
    place,
    submitReport,
    surface,
    t,
    tripId,
  ]);

  return {
    place,
    setPlace,
    location,
    photoUris,
    addPhotos,
    removePhoto,
    uploadProgress,
    condition,
    setCondition,
    surface,
    setSurface,
    hazards,
    setHazards,
    notes,
    setNotes,
    error,
    isValid,
    isSubmitting: isPending,
    submit,
  };
}

export type TrailConditionFormState = ReturnType<typeof useTrailConditionForm>;
