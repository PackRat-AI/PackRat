import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { TextInput } from 'expo-app/components/TextInput';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import type { TrailConditionFormState } from '../hooks/useTrailConditionForm';
import { capitalizeFirst } from '../lib/display';
import { HAZARD_OPTIONS, OVERALL_CONDITIONS, TRAIL_SURFACES } from '../types';
import { HazardChips } from './HazardChips';
import { OptionSegmentedControl } from './OptionSegmentedControl';
import { ReportPhotoPicker } from './ReportPhotoPicker';
import { TrailPicker } from './TrailPicker';

interface SubmitTrailConditionFormProps {
  form: TrailConditionFormState;
}

/**
 * The report form body, mirroring `SubmitTrailConditionView`'s `Form` in
 * `TrailConditionsView.swift`: the trail (picked, or a dropped pin), then condition, surface,
 * hazards, notes and photos.
 *
 * Cancel and Submit are not here — they live in the native header, driven by the same
 * `useTrailConditionForm` state, matching the Swift form's toolbar placement.
 *
 * The previous Expo form also collected water crossings and their difficulty. Those are dropped
 * to match iOS, which does not ask for them. The API still returns the fields, so the detail view
 * continues to render crossings on reports submitted by other clients.
 */
export function SubmitTrailConditionForm({ form }: SubmitTrailConditionFormProps) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const [pickingTrail, setPickingTrail] = useState(false);
  const { place } = form;

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="gap-6 p-4 pb-10"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View className="gap-3">
          <Text variant="caption1" className="uppercase tracking-wide text-muted-foreground">
            {t('trailConditions.trail')}
          </Text>
          <Pressable
            onPress={() => setPickingTrail(true)}
            disabled={form.isSubmitting}
            testID={testIds.trailConditions.chooseTrailBtn}
            accessibilityRole="button"
            className="flex-row items-center gap-3 rounded-xl bg-card px-4 py-3 active:opacity-80"
          >
            <Icon
              name={place?.kind === 'pin' ? 'map-marker' : 'hiking'}
              size={20}
              color={colors.primary}
            />
            <View className="flex-1">
              <Text
                variant="body"
                className={place ? 'text-foreground' : 'text-primary'}
                numberOfLines={1}
              >
                {place
                  ? place.kind === 'trail'
                    ? place.trail.name
                    : place.label
                  : t('trailConditions.chooseTrail')}
              </Text>
              {place?.kind === 'pin' ? (
                <Text variant="caption1" className="text-muted-foreground">
                  {t('trailConditions.pinnedLocation')}
                </Text>
              ) : null}
            </View>
            <Icon name="chevron-right" size={18} color={colors.grey} />
          </Pressable>
        </View>

        <OptionSegmentedControl
          label={t('trailConditions.overallCondition')}
          options={OVERALL_CONDITIONS}
          value={form.condition}
          onChange={form.setCondition}
          formatLabel={capitalizeFirst}
          testIDForOption={testIds.trailConditions.conditionOption}
        />

        <OptionSegmentedControl
          label={t('trailConditions.surface')}
          options={TRAIL_SURFACES}
          value={form.surface}
          onChange={form.setSurface}
          formatLabel={capitalizeFirst}
          testIDForOption={testIds.trailConditions.surfaceOption}
        />

        <HazardChips
          label={t('trailConditions.hazards')}
          options={HAZARD_OPTIONS}
          selected={form.hazards}
          onChange={form.setHazards}
        />

        <View className="gap-3">
          <Text variant="caption1" className="uppercase tracking-wide text-muted-foreground">
            {t('trailConditions.notes')}
          </Text>
          <TextInput
            value={form.notes}
            onChangeText={form.setNotes}
            placeholder={t('trailConditions.notesPlaceholder')}
            placeholderTextColor={colors.grey}
            testID={testIds.trailConditions.notesInput}
            accessibilityLabel={t('trailConditions.notes')}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="min-h-24 rounded-xl bg-card px-4 py-3 text-foreground"
          />
        </View>

        <ReportPhotoPicker
          photoUris={form.photoUris}
          onAdd={form.addPhotos}
          onRemove={form.removePhoto}
          isLocked={form.isSubmitting}
        />

        {form.uploadProgress ? (
          <Text variant="footnote" className="text-muted-foreground">
            {t('trailConditions.uploadingPhoto', {
              current: Math.min(form.uploadProgress.completed + 1, form.uploadProgress.total),
              total: form.uploadProgress.total,
            })}
          </Text>
        ) : null}

        {form.error ? (
          <View className="rounded-xl bg-destructive/10 p-4">
            <Text variant="footnote" className="text-destructive" wrap>
              {form.error}
            </Text>
          </View>
        ) : null}
      </ScrollView>
      <TrailPicker
        visible={pickingTrail}
        selectedTrailId={place?.kind === 'trail' ? place.trail.id : null}
        onPick={(picked) => {
          form.setPlace(picked);
          setPickingTrail(false);
        }}
        onClose={() => setPickingTrail(false)}
      />
    </KeyboardAvoidingView>
  );
}
