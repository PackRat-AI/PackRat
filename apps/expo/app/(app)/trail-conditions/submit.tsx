import { getAppBarOptions } from '@packrat/ui/src/app-bar';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import { SubmitTrailConditionForm } from 'expo-app/features/trail-conditions/components/SubmitTrailConditionForm';
import { useTrailConditionForm } from 'expo-app/features/trail-conditions/hooks/useTrailConditionForm';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

/**
 * The submit form — `SubmitTrailConditionView` in `TrailConditionsView.swift`.
 *
 * Presented as a full-screen modal (registered in `_layout.tsx`) rather than a sheet: Material 3
 * reserves bottom sheets for quick edits and puts multi-field entry in a full-screen surface, and
 * a `formSheet` on Android cannot render a native header at all — which is where Cancel and
 * Submit belong, matching the Swift form's toolbar.
 *
 * Form state lives in `useTrailConditionForm` so the header buttons and the form body can share
 * it; the header is rendered by the navigator, outside the form's own tree.
 */
export default function SubmitTrailConditionScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { tripId, trailName } = useLocalSearchParams<{ tripId?: string; trailName?: string }>();

  const form = useTrailConditionForm({
    tripId,
    initialTrailName: trailName,
    onSubmitted: () => router.back(),
  });

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          ...getAppBarOptions(),
          title: t('trailConditions.reportConditionsTitle'),
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              testID={testIds.trailConditions.formCancelBtn}
              accessibilityRole="button"
              className="p-2"
            >
              <Text variant="body" className="text-primary">
                {t('common.cancel')}
              </Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={form.submit}
              disabled={!form.isValid || form.isSubmitting}
              testID={testIds.trailConditions.formSubmitBtn}
              accessibilityRole="button"
              accessibilityState={{ disabled: !form.isValid || form.isSubmitting }}
              className="p-2"
            >
              {form.isSubmitting ? (
                <ActivityIndicator />
              ) : (
                <Text
                  variant="body"
                  className={form.isValid ? 'font-semibold text-primary' : 'text-muted-foreground'}
                >
                  {t('trailConditions.submit')}
                </Text>
              )}
            </Pressable>
          ),
        }}
      />
      <SubmitTrailConditionForm form={form} />
    </View>
  );
}
