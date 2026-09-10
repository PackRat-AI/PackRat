import type { MaterialCommunityIconsProps } from 'expo-app/components/Icon/types';

/** Glyph names MaterialCommunityIcons actually ships. */
type MaterialCommunityIconName = MaterialCommunityIconsProps['name'];

/**
 * Paywall copy — the Expo half of the computed strings in
 * `apps/swift/Sources/PackRat/Subscriptions/PackRatPaywallView.swift`
 * (`headline`, `subheadline`, `ctaTitle`, `finePrint`).
 *
 * # Why this is a module and not inline JSX
 *
 * Every string here is a conversion decision with a documented reason, and
 * three of them have been got wrong before — see ADR-005 in
 * `docs/features/early-access-subscriptions.md`. Pulling them out means the
 * rules can be asserted, and the one that keeps regressing (never argue for
 * waiting) is covered by a test rather than by a reviewer noticing.
 *
 * # The rule that governs all of it
 *
 * **Nothing here may state or imply that waiting is an option.** No countdown
 * to free, in either direction — not "free for everyone in 42 days" and not
 * "42 days ahead of everyone else". Both are accurate, and both tell a reader
 * deciding whether to pay that they could have the thing by doing nothing. The
 * graduation promise is real and documented; it is not this screen's argument.
 */

/** Who is looking at the paywall, and what prompted it. */
export interface PaywallCopyContext {
  /**
   * Display name of the gated feature this was opened for, or null when opened
   * from Settings as a general upgrade — where no one feature prompted it.
   */
  featureName: string | null;
  /** Whether the viewer is signed in. Guests may look, but may not buy. */
  isAuthenticated: boolean;
  /** Whether the selected plan is a one-off purchase rather than a renewal. */
  isLifetimeSelected: boolean;
  /** Whether a plan is selected at all — false while offerings are settling. */
  hasSelection: boolean;
}

/**
 * An invitation to act now, not a description of the pricing model. Nobody
 * subscribes because they understood the graduation schedule.
 */
export function paywallHeadline(featureName: string | null): string {
  if (!featureName) return 'Unlock access to all our exclusive features';
  return `Unlock ${featureName} today`;
}

/**
 * From Settings nothing on screen has explained what Pro is, so the subheadline
 * names the offer. From a gated feature the reader already knows what they
 * reached for, so it explains why they were stopped.
 */
export function paywallSubheadline(featureName: string | null): string {
  if (!featureName) {
    return 'Pro members get every new PackRat feature as soon as it’s built, while everyone else waits.';
  }
  return 'This feature is currently in early access and only available to our Pro members.';
}

/**
 * The standard App Store call to action. A guest is one step further out, and
 * the button says so rather than promising a purchase it will not start.
 */
export function paywallCtaLabel(context: PaywallCopyContext): string {
  if (!context.isAuthenticated) return 'Sign In to Subscribe';
  if (!context.hasSelection) return 'Continue';
  return context.isLifetimeSelected ? 'Buy Lifetime Access' : 'Continue';
}

/**
 * Says the one thing someone actually needs before paying: how to get out.
 * Anything else here is noise.
 */
export function paywallFinePrint(context: PaywallCopyContext): string {
  // Tell a guest what the next tap does before they take it, so the jump to
  // sign-in is expected rather than a surprise.
  if (!context.isAuthenticated) {
    return 'Subscriptions are tied to your PackRat account, so you’ll sign in first.';
  }
  if (context.isLifetimeSelected) return 'One payment. No subscription.';
  return 'Auto-renews until cancelled. Cancel anytime.';
}

/** A value prop row on the paywall. */
export interface PaywallValueProp {
  /**
   * MaterialCommunityIcons glyph name — the icon set the Expo app already
   * ships. Typed against the vector-icons name union rather than `string` so a
   * typo fails the build instead of rendering the "help" fallback glyph in
   * front of a paying customer.
   */
  icon: MaterialCommunityIconName;
  title: string;
  detail: string;
}

/**
 * What a subscription gets, in the order Swift lists it.
 *
 * When the paywall was opened from a specific feature and others are also in
 * early access, those are named first: the viewer is being shown the rest of
 * what they would get, which a general appeal cannot convey. From Settings the
 * headline already speaks to the whole set, so repeating it says nothing new.
 */
export interface PaywallValuePropsInput {
  /** The gated feature this was opened for, or null from Settings. */
  featureName: string | null;
  /** Other features currently in early access, already named and capped. */
  otherEarlyAccessFeatures: readonly string[];
}

export function paywallValueProps({
  featureName,
  otherEarlyAccessFeatures,
}: PaywallValuePropsInput): PaywallValueProp[] {
  const props: PaywallValueProp[] = [];

  if (featureName && otherEarlyAccessFeatures.length > 0) {
    props.push({
      icon: 'layers-triple',
      title: 'Everything else in early access',
      detail: otherEarlyAccessFeatures.join(' · '),
    });
  }

  props.push(
    {
      icon: 'arrow-up-circle',
      title: 'Try new features weeks before everyone else',
      detail: 'Pro members get early access to every new tool we ship.',
    },
    {
      icon: 'heart',
      title: 'You’re supporting a small team',
      detail:
        'PackRat is made by a handful of people who love the outdoors. Pro is what keeps us building it.',
    },
    {
      icon: 'autorenew',
      title: 'Cancel anytime',
      detail: 'Manage it from your store account, like any other subscription.',
    },
  );

  return props;
}
