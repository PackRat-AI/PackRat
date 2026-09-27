import * as Sentry from '@sentry/react-native';
import { useCallback, useState } from 'react';
import type { OverallCondition, TrailSurface } from '../types';
import { useSubmitTrailConditionReport } from './useTrailConditions';

interface UseTrailConditionFormOptions {
  tripId?: string;
  initialTrailName?: string;
  onSubmitted: () => void;
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
  initialTrailName = '',
  onSubmitted,
}: UseTrailConditionFormOptions) {
  const { mutateAsync: submitReport, isPending } = useSubmitTrailConditionReport();

  const [trailName, setTrailName] = useState(initialTrailName);
  const [trailRegion, setTrailRegion] = useState('');
  const [condition, setCondition] = useState<OverallCondition>('good');
  const [surface, setSurface] = useState<TrailSurface>('dirt');
  const [hazards, setHazards] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Matches `isValid` in the Swift form: the trail name is the only required field.
  const isValid = trailName.trim().length > 0;

  const submit = useCallback(async () => {
    if (!isValid || isPending) return;
    setError(null);
    Sentry.addBreadcrumb({
      category: 'trailConditions',
      message: 'Submitting trail condition report',
      level: 'info',
      data: { hazardCount: hazards.length, overallCondition: condition, surface },
    });
    try {
      await submitReport({
        trailName: trailName.trim(),
        trailRegion: trailRegion.trim() || null,
        surface,
        overallCondition: condition,
        hazards,
        notes: notes.trim() || null,
        tripId: tripId ?? null,
      });
      onSubmitted();
    } catch (err) {
      // The service already reported to Sentry with request context; surface it inline here,
      // where the Swift form shows its `InlineErrorView`.
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [
    condition,
    hazards,
    isPending,
    isValid,
    notes,
    onSubmitted,
    submitReport,
    surface,
    trailName,
    trailRegion,
    tripId,
  ]);

  return {
    trailName,
    setTrailName,
    trailRegion,
    setTrailRegion,
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
