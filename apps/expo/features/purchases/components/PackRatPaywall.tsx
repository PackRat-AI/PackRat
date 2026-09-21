import { PACKRAT_PRO_ENTITLEMENT } from '@packrat/config';
import { Button } from '@packrat/ui/src/button';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import { appAlert } from 'expo-app/app/_layout';
import { Icon } from 'expo-app/components/Icon';
import { useAuth } from 'expo-app/features/auth/hooks/useAuth';
import { testIds } from 'expo-app/lib/testIds';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { usePurchase } from '../hooks/usePurchase';
import { useRestorePurchases } from '../hooks/useRestorePurchases';
import {
  paywallCtaLabel,
  paywallFinePrint,
  paywallHeadline,
  paywallSubheadline,
  paywallValueProps,
} from '../utils/paywallCopy';
import {
  bestValuePackage,
  defaultPackage,
  isLifetime,
  planBillingDetail,
  planTitle,
} from '../utils/paywallPlans';

/**
 * PackRat's own early-access paywall — the Expo counterpart of
 * `apps/swift/Sources/PackRat/Subscriptions/PackRatPaywallView.swift`.
 *
 * Packages, prices and the purchase call come from RevenueCat; every pixel is
 * ours. Prices are read from `product.priceString` rather than computed, so
 * they stay correct in every storefront and currency.
 *
 * This replaced `RevenueCatUI.Paywall`. The template was configurable from the
 * dashboard, which sounds like an advantage until the copy rules in ADR-005
 * have to hold: those rules are decisions with reasons, and they belong next to
 * the reasons in version control rather than in a web form where a well-meaning
 * edit can quietly reintroduce a countdown to free.
 *
 * # On the copy
 *
 * Every string comes from `../utils/paywallCopy`. The job of this screen is to
 * convert, and nothing on it may state or imply that waiting is an option —
 * see that module and ADR-005.
 *
 * # Colour
 *
 * Fixed dark, like the Swift paywall. A paywall is a moment, not a place, and
 * the gradient is the same one on both platforms. Colours are literals rather
 * than theme tokens for exactly that reason — this surface deliberately does
 * not follow the app's light/dark setting.
 */

/** The app's own green, matching the Swift paywall's accent. */
const ACCENT = 'rgb(88, 194, 125)';
const BACKDROP_TOP = 'rgb(15, 28, 23)';
const BACKDROP_BOTTOM = 'rgb(8, 10, 10)';

interface PackRatPaywallProps {
  /** The offering to sell. Loaded before the paywall opens. */
  offering: PurchasesOffering;
  /**
   * Display name of the gated feature this was opened for, or null when opened
   * from Settings as a general upgrade.
   */
  featureName: string | null;
  /** Other features currently in early access, to list as what else Pro gets. */
  otherEarlyAccessFeatures: readonly string[];
  onDismiss: () => void;
  /** Called after a purchase or restore that actually granted the entitlement. */
  onEntitlementChanged: () => void;
}

/**
 * Copy for someone who just tried to pay. No internal vocabulary, and each one
 * says whether trying again is worthwhile. Same three outcomes and the same
 * wording as the Swift paywall.
 */
interface PurchaseAlert {
  title: string;
  message: string;
}

const PURCHASE_FAILED: PurchaseAlert = {
  title: 'Purchase Didn’t Go Through',
  message: 'You haven’t been charged. Please try again.',
};
const NOTHING_TO_RESTORE: PurchaseAlert = {
  title: 'Nothing to Restore',
  message: 'We couldn’t find a subscription on this account.',
};
const RESTORE_FAILED: PurchaseAlert = {
  title: 'Restore Failed',
  message: 'Please try again in a moment.',
};

export function PackRatPaywall({
  offering,
  featureName,
  otherEarlyAccessFeatures,
  onDismiss,
  onEntitlementChanged,
}: PackRatPaywallProps) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const { height } = useWindowDimensions();

  const packages = offering.availablePackages;
  const [selected, setSelected] = useState<PurchasesPackage | undefined>(() =>
    defaultPackage(packages),
  );

  const { mutateAsync: purchase, isPending: isPurchasing } = usePurchase();
  const { mutateAsync: restore, isPending: isRestoring } = useRestorePurchases();
  const isBusy = isPurchasing || isRestoring;

  const bestValue = useMemo(() => bestValuePackage(packages), [packages]);
  const valueProps = useMemo(
    () => paywallValueProps({ featureName, otherEarlyAccessFeatures }),
    [featureName, otherEarlyAccessFeatures],
  );

  const showAlert = ({ title, message }: PurchaseAlert) => {
    appAlert.current?.alert({ title, message, buttons: [{ text: 'OK', style: 'default' }] });
  };

  const copyContext = {
    featureName,
    isAuthenticated,
    isLifetimeSelected: isLifetime(selected),
    hasSelection: !!selected,
  };

  const handlePrimaryAction = async () => {
    // Value first, account at the point of intent. A guest has seen the offer
    // and the prices; tapping this button was already the decision, so it goes
    // straight to sign-in rather than to a welcome screen.
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    if (!selected) return;

    try {
      const { cancelled } = await purchase(selected);
      // Backing out of a purchase is ordinary. Say nothing.
      if (cancelled) return;
      onEntitlementChanged();
    } catch {
      showAlert(PURCHASE_FAILED);
    }
  };

  const handleRestore = async () => {
    try {
      const customerInfo = await restore();
      const granted = !!customerInfo.entitlements.active[PACKRAT_PRO_ENTITLEMENT];
      if (granted) {
        onEntitlementChanged();
      } else {
        showAlert(NOTHING_TO_RESTORE);
      }
    } catch {
      showAlert(RESTORE_FAILED);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: BACKDROP_BOTTOM }}>
      {/* Backdrop. A plain two-tone fill rather than a gradient dependency:
          expo-linear-gradient is not currently a dependency of this app, and a
          radial accent bloom is not worth adding one for. */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: height * 0.55,
          backgroundColor: BACKDROP_TOP,
        }}
      />

      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Close"
        testID={testIds.paywall.closeBtn}
        hitSlop={12}
        style={{
          position: 'absolute',
          top: 52,
          right: 18,
          zIndex: 10,
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.13)',
        }}
      >
        <Icon name="close" size={16} color="rgba(255,255,255,0.7)" />
      </Pressable>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 56, paddingBottom: 280 }}
      >
        {/* Hero. The app's own icon rather than a generic symbol: this is
            PackRat asking, and the mark is what people already recognise. */}
        <View style={{ alignItems: 'center', gap: 18 }}>
          <Image
            source={require('expo-app/assets/packrat-app-icon-gradient.png')}
            style={{ width: 84, height: 84, borderRadius: 19 }}
            resizeMode="contain"
          />
          <View style={{ gap: 10 }}>
            <Text
              testID={testIds.paywall.headline}
              className="text-center text-[33px] font-bold leading-[38px]"
              textColor="#ffffff"
            >
              {paywallHeadline(featureName)}
            </Text>
            <Text variant="subhead" className="text-center" textColor="rgba(255,255,255,0.68)">
              {paywallSubheadline(featureName)}
            </Text>
          </View>
        </View>

        {/* Value props */}
        <View style={{ marginTop: 30, gap: 10 }}>
          {valueProps.map((prop) => (
            <View key={prop.title} style={{ flexDirection: 'row', gap: 13 }}>
              <View style={{ width: 28, alignItems: 'center', paddingTop: 2 }}>
                <Icon
                  name={prop.icon}
                  size={17}
                  color={ACCENT}
                  materialIcon={{ type: 'MaterialCommunityIcons', name: prop.icon }}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="subhead" className="font-semibold" textColor="#ffffff">
                  {prop.title}
                </Text>
                <Text variant="footnote" textColor="rgba(255,255,255,0.58)">
                  {prop.detail}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Plans */}
        <View style={{ marginTop: 26, gap: 10 }}>
          {packages.map((pkg) => (
            <PlanRow
              key={pkg.identifier}
              pkg={pkg}
              isSelected={selected?.identifier === pkg.identifier}
              isBestValue={pkg.identifier === bestValue?.identifier}
              onSelect={() => setSelected(pkg)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Purchase dock */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 22,
          paddingTop: 16,
          paddingBottom: 32,
          gap: 11,
          backgroundColor: 'rgba(12,16,15,0.96)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <Button
          testID={testIds.paywall.ctaBtn}
          disabled={isBusy || (isAuthenticated && !selected)}
          onPress={handlePrimaryAction}
          className="min-h-[52px] rounded-2xl"
          style={{ backgroundColor: ACCENT }}
        >
          {isPurchasing ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <Text className="text-[17px] font-semibold" textColor="#000000">
              {paywallCtaLabel(copyContext)}
            </Text>
          )}
        </Button>

        {isAuthenticated && (
          <Button
            variant="plain"
            testID={testIds.paywall.restoreBtn}
            disabled={isBusy}
            onPress={handleRestore}
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color="rgba(255,255,255,0.62)" />
            ) : (
              <Text variant="subhead" className="font-medium" textColor="rgba(255,255,255,0.62)">
                Restore Purchases
              </Text>
            )}
          </Button>
        )}

        <Text variant="caption2" className="text-center" textColor="rgba(255,255,255,0.4)">
          {paywallFinePrint(copyContext)}
        </Text>
      </View>
    </View>
  );
}

interface PlanRowProps {
  pkg: PurchasesPackage;
  isSelected: boolean;
  isBestValue: boolean;
  onSelect: () => void;
}

function PlanRow({ pkg, isSelected, isBestValue, onSelect }: PlanRowProps) {
  const detail = planBillingDetail(pkg);

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      testID={testIds.paywall.planRow(pkg.identifier)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        padding: 15,
        borderRadius: 14,
        borderWidth: isSelected ? 1.6 : 1,
        borderColor: isSelected ? 'rgba(88,194,125,0.7)' : 'rgba(255,255,255,0.08)',
        backgroundColor: isSelected ? 'rgba(88,194,125,0.12)' : 'rgba(255,255,255,0.05)',
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: isSelected ? ACCENT : 'rgba(255,255,255,0.28)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isSelected && (
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: ACCENT }} />
        )}
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text className="font-semibold" textColor="#ffffff">
          {planTitle(pkg)}
        </Text>
        {detail && (
          <Text variant="caption1" textColor="rgba(255,255,255,0.55)">
            {detail}
          </Text>
        )}
      </View>

      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <Text className="font-semibold" textColor="#ffffff">
          {pkg.product.priceString}
        </Text>
        {isBestValue && (
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor: ACCENT,
            }}
          >
            <Text variant="caption2" className="font-bold tracking-wider" textColor="#000000">
              BEST VALUE
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
