import { ActivityIndicator, LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { featureFlags } from 'expo-app/config';
import { SubmitConditionReportForm } from 'expo-app/features/trail-conditions/components/SubmitConditionReportForm';
import { TrailConditionReportCard } from 'expo-app/features/trail-conditions/components/TrailConditionReportCard';
import { useTrailConditionReports } from 'expo-app/features/trail-conditions/hooks/useTrailConditionReports';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

export default function TrailConditionsScreen() {
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const { data: reports, isLoading, error } = useTrailConditionReports();
  const { t } = useTranslation();

  if (!featureFlags.enableTrailConditions) return null;

  return (
    <>
      <LargeTitleHeader
        title={t('trailConditions.title')}
        rightView={() => (
          <Pressable
            onPress={() => setShowSubmitForm(true)}
            className="mr-2 rounded-full bg-primary px-3 py-1.5"
            accessibilityLabel={t('trailConditions.reportConditionsTitle')}
            accessibilityRole="button"
          >
            <Text variant="footnote" className="font-semibold text-primary-foreground">
              {t('trailConditions.reportButton')}
            </Text>
          </Pressable>
        )}
      />

      <ScrollView className="flex-1">
        <View className="p-4">
          <Text variant="subhead" className="mb-2 text-muted-foreground">
            {t('trailConditions.subtitle')}
          </Text>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center py-12">
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View className="mx-4 mb-3 rounded-xl bg-card p-4">
            <Text variant="body" className="text-center text-muted-foreground">
              {t('trailConditions.loadError')}
            </Text>
          </View>
        ) : reports && reports.length > 0 ? (
          <View className="pb-4">
            {reports.map((report) => (
              <TrailConditionReportCard key={report.id} report={report} />
            ))}
          </View>
        ) : (
          <View className="mx-4 mb-3 rounded-xl bg-card p-8">
            <Text variant="body" className="text-center text-muted-foreground">
              {t('trailConditions.noReports')}
            </Text>
            <Pressable
              onPress={() => setShowSubmitForm(true)}
              className="mt-4 rounded-lg bg-primary px-4 py-3"
              accessibilityLabel={t('trailConditions.submitReport')}
              accessibilityRole="button"
            >
              <Text className="text-center font-semibold text-primary-foreground">
                {t('trailConditions.submitReport')}
              </Text>
            </Pressable>
          </View>
        )}

        <View className="mx-4 my-2 mb-6 rounded-lg bg-card p-4">
          <View className="rounded-md bg-muted p-3 dark:bg-gray-50/10">
            <Text variant="footnote" className="text-muted-foreground">
              {t('trailConditions.disclaimer')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Submit Report Modal */}
      <Modal
        visible={showSubmitForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSubmitForm(false)}
      >
        <View className="flex-1 bg-background">
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <Text variant="heading" className="font-semibold">
              {t('trailConditions.reportConditionsTitle')}
            </Text>
            <Pressable
              onPress={() => setShowSubmitForm(false)}
              accessibilityLabel={t('common.cancel')}
              accessibilityRole="button"
            >
              <Text className="font-semibold text-primary">{t('common.cancel')}</Text>
            </Pressable>
          </View>
          <SubmitConditionReportForm onSuccess={() => setShowSubmitForm(false)} />
        </View>
      </Modal>
    </>
  );
}
