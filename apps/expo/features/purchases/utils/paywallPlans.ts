/**
 * Plan presentation for the PackRat paywall — the Expo half of
 * `PackRatPaywallView`'s `title(for:)`, `detail(for:)` and `bestValuePackage`
 * in `apps/swift/Sources/PackRat/Subscriptions/PackRatPaywallView.swift`.
 *
 * Kept as pure functions over a package's `packageType` rather than inline in
 * the component so both platforms' plan ranking can be asserted against the
 * same table. Prices are never computed here: they come from the store as
 * `product.priceString`, so every storefront and currency stays correct.
 *
 * Each function is generic over the fields it actually reads rather than taking
 * `PurchasesPackage` whole. A real package is a large native-backed object, so
 * a narrower structural bound is what lets a test call these with an honest
 * literal instead of casting one through `as unknown`, and it documents at the
 * signature exactly which fields the plan UI depends on.
 */

/** The package fields the plan ranking reads. */
export interface RankablePackage {
  packageType: string;
}

/** The package fields a plan row's name is derived from. */
export interface TitleablePackage extends RankablePackage {
  identifier: string;
  product: { title?: string | null };
}

/**
 * Package type identifiers as `react-native-purchases` reports them. The SDK
 * types these as a loose string union, so the ones the paywall names are
 * pinned here.
 */
export const PACKAGE_TYPE = Object.freeze({
  annual: 'ANNUAL',
  sixMonth: 'SIX_MONTH',
  threeMonth: 'THREE_MONTH',
  twoMonth: 'TWO_MONTH',
  monthly: 'MONTHLY',
  weekly: 'WEEKLY',
  lifetime: 'LIFETIME',
} as const);

/**
 * Longest recurring plan first: cheapest per month, and what a subscription
 * app conventionally highlights. Lifetime is deliberately absent — a different
 * kind of purchase, not a better-value subscription — so it is never marked
 * best value and never preselected over a recurring plan.
 */
const BEST_VALUE_RANKING: readonly string[] = [
  PACKAGE_TYPE.annual,
  PACKAGE_TYPE.sixMonth,
  PACKAGE_TYPE.threeMonth,
  PACKAGE_TYPE.twoMonth,
  PACKAGE_TYPE.monthly,
  PACKAGE_TYPE.weekly,
];

/** Fallback plan names, used only when the store gives no localized title. */
const FALLBACK_TITLE: Readonly<Record<string, string>> = Object.freeze({
  [PACKAGE_TYPE.annual]: 'Yearly',
  [PACKAGE_TYPE.monthly]: 'Monthly',
  [PACKAGE_TYPE.weekly]: 'Weekly',
  [PACKAGE_TYPE.lifetime]: 'Lifetime',
  [PACKAGE_TYPE.sixMonth]: '6 Months',
  [PACKAGE_TYPE.threeMonth]: '3 Months',
  [PACKAGE_TYPE.twoMonth]: '2 Months',
});

/** How the plan bills, shown under its name. Absent where it adds nothing. */
const BILLING_DETAIL: Readonly<Record<string, string>> = Object.freeze({
  [PACKAGE_TYPE.annual]: 'Billed once a year',
  [PACKAGE_TYPE.monthly]: 'Billed monthly',
  [PACKAGE_TYPE.weekly]: 'Billed weekly',
  [PACKAGE_TYPE.lifetime]: 'One payment, yours for good',
});

/** A capitalized package identifier, for a type the ranking does not name. */
function titleFromIdentifier(identifier: string): string {
  if (!identifier) return '';
  return identifier.charAt(0).toUpperCase() + identifier.slice(1);
}

/**
 * The plan's display name: the store's own localized title when it has one,
 * so an App Store or Play Console rename reaches the paywall without a
 * release. Falls back to our own name for the package type, and finally to the
 * package identifier, so a row always has something to show.
 */
export function planTitle(pkg: TitleablePackage): string {
  const storeTitle = pkg.product.title?.trim();
  if (storeTitle) return storeTitle;
  return FALLBACK_TITLE[pkg.packageType] ?? titleFromIdentifier(pkg.identifier);
}

/** How the plan bills, or null when there is nothing worth saying. */
export function planBillingDetail(pkg: RankablePackage): string | null {
  return BILLING_DETAIL[pkg.packageType] ?? null;
}

/**
 * The plan to mark "BEST VALUE" and preselect. Falls back to the first
 * available package so a catalogue of only lifetime — or of a package type the
 * ranking does not name — still opens with a row selected and a live CTA.
 */
export function bestValuePackage<T extends RankablePackage>(packages: readonly T[]): T | undefined {
  for (const type of BEST_VALUE_RANKING) {
    const match = packages.find((pkg) => pkg.packageType === type);
    if (match) return match;
  }
  return undefined;
}

/** The row selected when the paywall opens. */
export function defaultPackage<T extends RankablePackage>(packages: readonly T[]): T | undefined {
  return bestValuePackage(packages) ?? packages.at(0);
}

/** Whether buying this plan is a one-off rather than a subscription. */
export function isLifetime(pkg: RankablePackage | undefined): boolean {
  return pkg?.packageType === PACKAGE_TYPE.lifetime;
}
