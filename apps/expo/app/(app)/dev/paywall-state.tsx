import { isInEarlyAccess, PACKRAT_PRO_ENTITLEMENT } from '@packrat/config';
import { Text } from '@packrat/ui/nativewindui';
import { useConnectivity } from 'expo-app/features/purchases/hooks/useConnectivity';
import { useCustomerInfo } from 'expo-app/features/purchases/hooks/useCustomerInfo';
import { useFeatureAccessConfig } from 'expo-app/features/purchases/hooks/useFeatureAccess';
import { isRevenueCatConfigured } from 'expo-app/features/purchases/lib/revenueCat';
import { Stack } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';

/**
 * Dev-only inspector for the two signals that drive the early-access paywall:
 * the RevenueCat `customerInfo` and the `feature-access` config. Shows their
 * live query/resolution state so you can see exactly what the gate would decide
 * (offline vs online, cached vs live, Pro vs not, which features are gated).
 * Reached from Settings → Developer → Paywall State (dev builds only).
 */
export default function PaywallStateScreen() {
  const connectivity = useConnectivity();
  const {
    data: customerInfo,
    isLoading: ciLoading,
    isFetching: ciFetching,
    isError: ciError,
    resolved: ciResolved,
    hadPersisted,
    persistedLoaded,
    dataUpdatedAt: ciUpdatedAt,
    refetch: refetchCustomerInfo,
  } = useCustomerInfo();
  const {
    data: config,
    isLoading: cfgLoading,
    isFetching: cfgFetching,
    isSuccess: cfgResolved,
    isError: cfgError,
    dataUpdatedAt: cfgUpdatedAt,
    refetch: refetchConfig,
  } = useFeatureAccessConfig();

  const activeEntitlements = customerInfo ? Object.keys(customerInfo.entitlements.active) : [];
  const isProMember = !!customerInfo?.entitlements.active[PACKRAT_PRO_ENTITLEMENT];
  const proEntitlement = customerInfo?.entitlements.active[PACKRAT_PRO_ENTITLEMENT];

  const refreshing = ciFetching || cfgFetching;
  const onRefresh = () => {
    void refetchCustomerInfo();
    void refetchConfig();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Paywall State' }} />
      <ScrollView
        className="flex-1 px-4 py-6"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="gap-6">
          <Section title="Environment">
            <Row label="Connectivity" value={connectivity} />
            <Row label="RevenueCat configured" value={yesNo(isRevenueCatConfigured())} />
          </Section>

          <Section title="customerInfo (RevenueCat)">
            <Row label="resolved" value={yesNo(ciResolved)} highlight={!ciResolved} />
            <Row label="isLoading" value={yesNo(ciLoading)} />
            <Row label="isFetching" value={yesNo(ciFetching)} />
            <Row label="isError" value={yesNo(ciError)} highlight={ciError} />
            <Row label="has data" value={yesNo(!!customerInfo)} />
            <Row label="persisted copy loaded" value={yesNo(persistedLoaded)} />
            <Row label="had persisted copy" value={yesNo(hadPersisted)} />
            <Row label="updated at" value={fmtTime(ciUpdatedAt)} />
            <Row
              label={`isPro (${PACKRAT_PRO_ENTITLEMENT})`}
              value={yesNo(isProMember)}
              highlight
            />
            <Row
              label="active entitlements"
              value={activeEntitlements.length ? activeEntitlements.join(', ') : '(none)'}
            />
            {proEntitlement && (
              <>
                <Row label="Pro expires" value={proEntitlement.expirationDate ?? 'never'} />
                <Row label="Pro store" value={proEntitlement.store ?? '—'} />
                <Row label="will renew" value={yesNo(proEntitlement.willRenew)} />
              </>
            )}
          </Section>

          <Section title="feature-access config">
            <Row label="resolved (isSuccess)" value={yesNo(cfgResolved)} highlight={!cfgResolved} />
            <Row label="isLoading" value={yesNo(cfgLoading)} />
            <Row label="isFetching" value={yesNo(cfgFetching)} />
            <Row label="isError" value={yesNo(cfgError)} highlight={cfgError} />
            <Row label="updated at" value={fmtTime(cfgUpdatedAt)} />
            <Row label="feature count" value={String(config?.length ?? 0)} />
          </Section>

          {(config ?? []).map((f) => {
            const inEarlyAccess = isInEarlyAccess(f);
            return (
              <Section key={f.key} title={`${f.label} (${f.key})`}>
                <Row
                  label="state"
                  value={inEarlyAccess ? 'EARLY ACCESS (Pro-gated)' : 'GA / free'}
                  highlight={inEarlyAccess}
                />
                <Row
                  label="earlyAccessUntil"
                  value={f.earlyAccessUntil ? new Date(f.earlyAccessUntil).toISOString() : 'null'}
                />
                <Row label="would allow this viewer" value={yesNo(!inEarlyAccess || isProMember)} />
              </Section>
            );
          })}

          <Text variant="footnote" color="tertiary" className="self-center mt-4">
            Pull to refresh · dev only
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text variant="subhead" className="mb-2">
        {title}
      </Text>
      <View className="rounded-xl border border-border bg-card px-4 py-1">{children}</View>
    </View>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-2 gap-3">
      <Text variant="footnote" color="secondary" className="flex-1">
        {label}
      </Text>
      <Text
        variant="footnote"
        className={`text-right ${highlight ? 'font-semibold text-primary' : ''}`}
      >
        {value}
      </Text>
    </View>
  );
}

function yesNo(v: boolean): string {
  return v ? 'yes' : 'no';
}

function fmtTime(ts: number | undefined): string {
  if (!ts) return 'never';
  return new Date(ts).toLocaleTimeString();
}
