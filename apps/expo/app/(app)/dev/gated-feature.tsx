import { Text } from '@packrat/ui/src/text';
import { EarlyAccessGate } from 'expo-app/features/purchases';
import { useFeatureAccessConfig } from 'expo-app/features/purchases/hooks/useFeatureAccess';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

/**
 * A stub feature behind `EarlyAccessGate`, for exercising the gate and the
 * paywall by hand.
 *
 * No shipping screen is gated yet, so without this there is no way to see what
 * a gated feature actually does — the paywall can only be reached from
 * Settings, which is the *general* upgrade path and deliberately shows
 * different copy. The gated path is where the feature-specific headline, the
 * "other features in early access" list, and every offline fallback live.
 *
 * Takes the feature key as a route param so one screen covers every case:
 * a key in an active early-access window, a graduated one, and a key with no
 * config row at all. Reached from Settings → Developer → Gated Feature; the
 * whole Developer section is dev-build only.
 *
 * The content below the gate is deliberately dull. If you can read it, the gate
 * let you through — that is the entire assertion.
 */
export default function GatedFeatureScreen() {
  const { featureKey } = useLocalSearchParams<{ featureKey?: string }>();
  const key = featureKey ?? 'summit-log';

  return (
    <>
      <Stack.Screen options={{ title: 'Gated Feature' }} />
      <EarlyAccessGate featureKey={key}>
        <UnlockedContent featureKey={key} />
      </EarlyAccessGate>
    </>
  );
}

/** What a viewer sees only once the gate has allowed them through. */
function UnlockedContent({ featureKey }: { featureKey: string }) {
  const { data: config } = useFeatureAccessConfig();
  const feature = config?.find((f) => f.key === featureKey);
  const until = feature?.earlyAccessUntil ? new Date(feature.earlyAccessUntil) : null;

  return (
    <ScrollView className="flex-1 px-4 py-6" contentInsetAdjustmentBehavior="automatic">
      <View className="gap-4">
        <View className="rounded-xl border border-border bg-card p-4">
          <Text variant="title3" className="mb-1">
            You're through the gate
          </Text>
          <Text variant="footnote" color="secondary" wrap>
            Seeing this means the gate resolved and allowed you. Either the feature is generally
            available, or you hold the Pro entitlement.
          </Text>
        </View>

        <View className="rounded-xl border border-border bg-card p-4">
          <Row label="Feature key" value={featureKey} />
          <Row label="Has a config row" value={feature ? 'yes' : 'no'} />
          <Row label="Label" value={feature?.label ?? '—'} />
          <Row
            label="Early access until"
            value={until ? until.toLocaleString() : 'not set (generally available)'}
          />
          <Row
            label="Window"
            value={until ? (until > new Date() ? 'open — Pro only' : 'graduated — free') : 'none'}
          />
        </View>

        <Text variant="footnote" color="secondary" wrap>
          A key with no config row is generally available by design, so it should always let you
          through. To see the paywall, use a key whose window is still open.
        </Text>
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-4 py-1.5">
      <Text variant="footnote" color="secondary">
        {label}
      </Text>
      <Text variant="footnote" className="flex-1 text-right" wrap>
        {value}
      </Text>
    </View>
  );
}
