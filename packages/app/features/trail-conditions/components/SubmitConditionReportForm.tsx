import { Text } from '@packrat/ui/nativewindui';
import { TextInput } from 'app/components/TextInput';
import { useTranslation } from 'app/lib/hooks/useTranslation';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSubmitTrailConditionReport } from '../hooks/useSubmitTrailConditionReport';
import type { OverallCondition, TrailSurface, WaterCrossingDifficulty } from '../types';

const SURFACE_OPTIONS: TrailSurface[] = ['paved', 'gravel', 'dirt', 'rocky', 'snow', 'mud'];
const CONDITION_OPTIONS: OverallCondition[] = ['excellent', 'good', 'fair', 'poor'];
const HAZARD_OPTIONS = [
  'fallen trees',
  'wildlife',
  'erosion',
  'closure',
  'ice',
  'flooding',
  'loose rock',
];
const WATER_DIFFICULTY_OPTIONS: WaterCrossingDifficulty[] = ['easy', 'moderate', 'difficult'];

interface SubmitConditionReportFormProps {
  onSuccess?: () => void;
  tripId?: string;
  initialTrailName?: string;
}

export function SubmitConditionReportForm({
  onSuccess,
  tripId,
  initialTrailName = '',
}: SubmitConditionReportFormProps) {
  const { t } = useTranslation();
  const { submit: submitReport, isPending: isSubmitting } = useSubmitTrailConditionReport();

  const [trailName, setTrailName] = useState(initialTrailName);
  const [trailRegion, setTrailRegion] = useState('');
  const [surface, setSurface] = useState<TrailSurface>('dirt');
  const [overallCondition, setOverallCondition] = useState<OverallCondition>('good');
  const [selectedHazards, setSelectedHazards] = useState<string[]>([]);
  const [waterCrossings, setWaterCrossings] = useState(0);
  const [waterCrossingDifficulty, setWaterCrossingDifficulty] =
    useState<WaterCrossingDifficulty | null>(null);
  const [notes, setNotes] = useState('');

  const toggleHazard = (hazard: string) => {
    setSelectedHazards((prev) =>
      prev.includes(hazard) ? prev.filter((h) => h !== hazard) : [...prev, hazard],
    );
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!trailName.trim()) {
      Alert.alert(t('common.error'), t('trailConditions.trailNameRequired'));
      return;
    }
    try {
      await submitReport({
        trailName: trailName.trim(),
        trailRegion: trailRegion.trim() || null,
        surface,
        overallCondition,
        hazards: selectedHazards,
        waterCrossings,
        waterCrossingDifficulty: waterCrossings > 0 ? waterCrossingDifficulty : null,
        notes: notes.trim() || null,
        photos: [],
        tripId: tripId ?? null,
      });
      Alert.alert(t('common.success'), t('trailConditions.reportSubmitted'));
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert(t('common.error'), message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView contentContainerClassName="p-4 pb-12" showsVerticalScrollIndicator={false}>
        {/* Trail Name */}
        <View className="mb-4">
          <Text variant="subhead" className="mb-1 font-medium">
            {t('trailConditions.trailName')} *
          </Text>
          <TextInput
            className="rounded-lg border border-border bg-card px-3 py-3 text-foreground"
            placeholder={t('trailConditions.trailNamePlaceholder')}
            value={trailName}
            onChangeText={setTrailName}
          />
        </View>

        {/* Trail Region */}
        <View className="mb-4">
          <Text variant="subhead" className="mb-1 font-medium">
            {t('trailConditions.trailRegion')}
          </Text>
          <TextInput
            className="rounded-lg border border-border bg-card px-3 py-3 text-foreground"
            placeholder={t('trailConditions.trailRegionPlaceholder')}
            value={trailRegion}
            onChangeText={setTrailRegion}
          />
        </View>

        {/* Overall Condition */}
        <View className="mb-4">
          <Text variant="subhead" className="mb-2 font-medium">
            {t('trailConditions.overallCondition')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {CONDITION_OPTIONS.map((cond) => (
              <Pressable
                key={cond}
                onPress={() => setOverallCondition(cond)}
                accessibilityRole="button"
                accessibilityState={{ selected: overallCondition === cond }}
                accessibilityLabel={`${t('trailConditions.overallCondition')}: ${cond.charAt(0).toUpperCase() + cond.slice(1)}`}
                className={`rounded-full border px-4 py-2 ${
                  overallCondition === cond ? 'border-primary bg-primary' : 'border-border bg-card'
                }`}
              >
                <Text
                  variant="footnote"
                  className={
                    overallCondition === cond ? 'font-semibold text-primary-foreground' : ''
                  }
                >
                  {cond.charAt(0).toUpperCase() + cond.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Trail Surface */}
        <View className="mb-4">
          <Text variant="subhead" className="mb-2 font-medium">
            {t('trailConditions.surface')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {SURFACE_OPTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => setSurface(s)}
                accessibilityRole="button"
                accessibilityState={{ selected: surface === s }}
                accessibilityLabel={`${t('trailConditions.surface')}: ${s.charAt(0).toUpperCase() + s.slice(1)}`}
                className={`rounded-full border px-4 py-2 ${
                  surface === s ? 'border-primary bg-primary' : 'border-border bg-card'
                }`}
              >
                <Text
                  variant="footnote"
                  className={surface === s ? 'font-semibold text-primary-foreground' : ''}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Hazards */}
        <View className="mb-4">
          <Text variant="subhead" className="mb-2 font-medium">
            {t('trailConditions.hazards')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {HAZARD_OPTIONS.map((hazard) => (
              <Pressable
                key={hazard}
                onPress={() => toggleHazard(hazard)}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedHazards.includes(hazard) }}
                accessibilityLabel={`${t('trailConditions.hazards')}: ${hazard}`}
                className={`rounded-full border px-3 py-1.5 ${
                  selectedHazards.includes(hazard)
                    ? 'border-amber-500 bg-amber-500'
                    : 'border-border bg-card'
                }`}
              >
                <Text
                  variant="footnote"
                  className={selectedHazards.includes(hazard) ? 'font-medium text-white' : ''}
                >
                  {hazard}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Water Crossings */}
        <View className="mb-4">
          <Text variant="subhead" className="mb-2 font-medium">
            {t('trailConditions.waterCrossings')}
          </Text>
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => setWaterCrossings(Math.max(0, waterCrossings - 1))}
              accessibilityRole="button"
              accessibilityLabel={`${t('trailConditions.waterCrossings')}: decrease, current ${waterCrossings}`}
              accessibilityState={{ disabled: waterCrossings === 0 }}
              className="h-9 w-9 items-center justify-center rounded-full border border-border bg-card"
            >
              <Text className="text-lg font-bold">−</Text>
            </Pressable>
            <Text variant="body" className="min-w-8 text-center font-semibold">
              {waterCrossings}
            </Text>
            <Pressable
              onPress={() => setWaterCrossings(Math.min(20, waterCrossings + 1))}
              accessibilityRole="button"
              accessibilityLabel={`${t('trailConditions.waterCrossings')}: increase, current ${waterCrossings}`}
              accessibilityState={{ disabled: waterCrossings === 20 }}
              className="h-9 w-9 items-center justify-center rounded-full border border-border bg-card"
            >
              <Text className="text-lg font-bold">+</Text>
            </Pressable>
          </View>

          {waterCrossings > 0 && (
            <View className="mt-2 flex-row flex-wrap gap-2">
              <Text variant="footnote" className="w-full text-muted-foreground">
                {t('trailConditions.difficulty')}:
              </Text>
              {WATER_DIFFICULTY_OPTIONS.map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setWaterCrossingDifficulty(d)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: waterCrossingDifficulty === d }}
                  accessibilityLabel={`${t('trailConditions.difficulty')}: ${d.charAt(0).toUpperCase() + d.slice(1)}`}
                  className={`rounded-full border px-3 py-1.5 ${
                    waterCrossingDifficulty === d
                      ? 'border-primary bg-primary'
                      : 'border-border bg-card'
                  }`}
                >
                  <Text
                    variant="footnote"
                    className={
                      waterCrossingDifficulty === d ? 'font-medium text-primary-foreground' : ''
                    }
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Notes */}
        <View className="mb-6">
          <Text variant="subhead" className="mb-1 font-medium">
            {t('trailConditions.notes')}
          </Text>
          <TextInput
            className="h-24 rounded-lg border border-border bg-card px-3 py-3 text-foreground"
            placeholder={t('trailConditions.notesPlaceholder')}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Submit Button */}
        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel={t('trailConditions.submitReport')}
          accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
          className={`rounded-lg px-4 py-3.5 ${isSubmitting ? 'bg-primary/60' : 'bg-primary'}`}
        >
          <Text className="text-center text-base font-semibold text-primary-foreground">
            {isSubmitting ? 'Submitting…' : t('trailConditions.submitReport')}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
