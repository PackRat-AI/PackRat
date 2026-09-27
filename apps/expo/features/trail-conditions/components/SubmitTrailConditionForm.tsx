import { Text } from '@packrat/ui/src/text';
import { TextInput } from 'expo-app/components/TextInput';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import type { TrailConditionFormState } from '../hooks/useTrailConditionForm';
import { capitalizeFirst } from '../lib/display';
import { HAZARD_OPTIONS, OVERALL_CONDITIONS, TRAIL_SURFACES } from '../types';
import { HazardChips } from './HazardChips';
import { OptionSegmentedControl } from './OptionSegmentedControl';

interface SubmitTrailConditionFormProps {
  form: TrailConditionFormState;
}

/**
 * The report form body, mirroring `SubmitTrailConditionView`'s `Form` in
 * `TrailConditionsView.swift`: trail and region, then condition, surface, hazards and notes.
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
            {t('trailConditions.trailName')}
          </Text>
          <TextInput
            value={form.trailName}
            onChangeText={form.setTrailName}
            placeholder={t('trailConditions.trailNamePlaceholder')}
            placeholderTextColor={colors.grey}
            testID={testIds.trailConditions.trailNameInput}
            accessibilityLabel={t('trailConditions.trailName')}
            returnKeyType="next"
            className="rounded-xl bg-card px-4 py-3 text-foreground"
          />
          <TextInput
            value={form.trailRegion}
            onChangeText={form.setTrailRegion}
            placeholder={t('trailConditions.trailRegionPlaceholder')}
            placeholderTextColor={colors.grey}
            testID={testIds.trailConditions.trailRegionInput}
            accessibilityLabel={t('trailConditions.trailRegion')}
            returnKeyType="done"
            className="rounded-xl bg-card px-4 py-3 text-foreground"
          />
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

        {form.error ? (
          <View className="rounded-xl bg-destructive/10 p-4">
            <Text variant="footnote" className="text-destructive" wrap>
              {form.error}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
