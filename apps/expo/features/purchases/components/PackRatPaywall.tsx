import { PACKRAT_PRO_ENTITLEMENT } from '@packrat/config';
import { Button } from '@packrat/ui/src/button';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import { appAlert } from 'expo-app/app/_layout';
import { Icon } from 'expo-app/components/Icon';
import { useAuth } from 'expo-app/features/auth/hooks/useAuth';
import { testIds } from 'expo-app/lib/testIds';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
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
  planPeriodSuffix,
  planPricePerMonth,
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

/**
 * The app's own blue — `primary` from `theme/colors.ts` for Android dark.
 * Hardcoded rather than read from the theme because this screen is fixed dark
 * and must not follow the light/dark setting; see the note above.
 */
const ACCENT = 'rgb(3, 133, 255)';

/**
 * The backdrop, as gradient stops from top to bottom.
 *
 * This was previously two flat blocks — a tinted one absolutely positioned over
 * the top 55% of the screen, and the base colour below it. With no blend
 * between them the seam was plainly visible as a horizontal line across the
 * middle of the paywall. These are fed to a real gradient instead.
 */
const BACKDROP_GRADIENT = ['rgb(10, 22, 40)', 'rgb(7, 12, 20)', 'rgb(6, 8, 11)'] as const;

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

  const packages = offering.availablePackages;
  const [selected, setSelected] = useState<PurchasesPackage | undefined>(() =>
    defaultPackage(packages),
  );

  // Seeded high enough that the first paint never hides content behind the
  // dock; replaced by the real height on layout.
  const [dockHeight, setDockHeight] = useState(320);

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
    <View style={{ flex: 1 }}>
      {/* Backdrop. A real gradient over the whole screen: the previous
          two-block fill met at a hard edge partway down and read as the screen
          being split in half. */}
      <LinearGradient
        colors={BACKDROP_GRADIENT}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
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
        // Bottom padding is the dock's measured height, not a guess. The dock
        // grows and shrinks with its contents — the plan cards, and a Restore
        // row only signed-in viewers see — so a hardcoded clearance is wrong
        // for somebody the moment any of that changes.
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingTop: 56,
          paddingBottom: dockHeight + 24,
        }}
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
      </ScrollView>

      {/* Purchase dock — the plans and the button that buys them, pinned
          together so neither can scroll away from the other. */}
      <View
        onLayout={(event) => setDockHeight(event.nativeEvent.layout.height)}
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
        {/* Plans live in the dock rather than in the scrolling content, so the
            thing being bought is on screen at the same moment as the button
            that buys it. Scrolled away, the CTA asks for money for a plan the
            viewer can no longer see or change. */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 5 }}>
          {packages.map((pkg) => (
            <PlanCard
              key={pkg.identifier}
              pkg={pkg}
              isSelected={selected?.identifier === pkg.identifier}
              isBestValue={pkg.identifier === bestValue?.identifier}
              onSelect={() => setSelected(pkg)}
            />
          ))}
        </View>

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

interface PlanCardProps {
  pkg: PurchasesPackage;
  isSelected: boolean;
  isBestValue: boolean;
  onSelect: () => void;
}

/**
 * One plan, as a card in a row of them.
 *
 * Every card reserves the same vertical slots — badge, name, price, per-month —
 * whether or not it has something to put in each. A card with no "BEST VALUE"
 * badge still holds that row's height, so the plan names sit on one line across
 * the row and the prices line up with each other. Letting each card size itself
 * would stagger the prices and make two plans harder to compare, which is the
 * one thing this layout exists to make easy.
 */
function PlanCard({ pkg, isSelected, isBestValue, onSelect }: PlanCardProps) {
  const periodSuffix = planPeriodSuffix(pkg);
  const pricePerMonth = planPricePerMonth(pkg);

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      testID={testIds.paywall.planRow(pkg.identifier)}
      style={{
        flex: 1,
        paddingHorizontal: 10,
        paddingTop: 10,
        paddingBottom: 14,
        borderRadius: 16,
        alignItems: 'center',
        // Constant width, colour-only selection. The border is laid out inside
        // the card, so growing it on selection shrinks the content box and
        // nudges the price and name by a fraction of a point — which reads as
        // the plans twitching every time one is tapped.
        borderWidth: 1.6,
        borderColor: isSelected ? ACCENT : 'rgba(255,255,255,0.10)',
        backgroundColor: isSelected ? 'rgba(3,133,255,0.14)' : 'rgba(255,255,255,0.05)',
      }}
    >
      {/* Badge slot. Always occupies its height, whether or not a badge is in
          it, so the names and prices stay level across the row.

          The badge stays on the best-value plan whether or not it is selected —
          it is a fact about the plan, and hiding it once the viewer picks
          something else removes the very comparison it exists to make. But it
          only wears the accent while that plan is the active one: a solid
          accent badge on an unselected card reads as the selection, which
          leaves two cards looking chosen at once. Unselected, it keeps the
          shape and drops to a muted outline. */}
      <View style={{ height: 18, justifyContent: 'center' }}>
        {isBestValue && (
          <View
            style={{
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor: isSelected ? ACCENT : 'transparent',
              borderWidth: 1,
              borderColor: isSelected ? ACCENT : 'rgba(255,255,255,0.28)',
            }}
          >
            <Text
              variant="caption2"
              className="font-bold"
              textColor={isSelected ? '#ffffff' : 'rgba(255,255,255,0.55)'}
            >
              BEST VALUE
            </Text>
          </View>
        )}
      </View>

      {/* Name and price each sit in a slot of fixed height. Left to size
          themselves they would be as tall as whatever they happen to contain,
          so a price that shrinks to fit — see `adjustsFontSizeToFit` below —
          would pull everything under it upward, and one card's longer name
          would push its own price below its neighbours'. */}
      <View style={{ height: 22, justifyContent: 'center' }}>
        <Text
          variant="subhead"
          className="text-center font-semibold"
          numberOfLines={1}
          textColor="#ffffff"
        >
          {planTitle(pkg)}
        </Text>
      </View>

      {/* `adjustsFontSizeToFit` keeps a long localized amount on one line
          instead of wrapping. It changes the glyph size, not the slot. */}
      <View style={{ height: 28, justifyContent: 'center', alignSelf: 'stretch' }}>
        <Text
          className="text-center text-[19px] font-bold"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          textColor="#ffffff"
        >
          {pkg.product.priceString}
        </Text>
      </View>

      <View style={{ height: 16, justifyContent: 'center' }}>
        {periodSuffix && (
          <Text variant="caption2" textColor="rgba(255,255,255,0.55)">
            {periodSuffix}
          </Text>
        )}
      </View>

      {/* Per-month equivalent — the figure that makes a longer plan legible as
          the cheaper one. Blank where it would say nothing (a monthly plan
          repeating itself, or a lifetime purchase). */}
      <View style={{ height: 15, justifyContent: 'center' }}>
        {pricePerMonth && (
          <Text variant="caption2" numberOfLines={1} textColor="rgba(255,255,255,0.45)">
            {pricePerMonth} / mo
          </Text>
        )}
      </View>
    </Pressable>
  );
}
