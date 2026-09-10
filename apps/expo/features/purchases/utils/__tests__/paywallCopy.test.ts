import { describe, expect, it } from 'vitest';
import {
  type PaywallCopyContext,
  paywallCtaLabel,
  paywallFinePrint,
  paywallHeadline,
  paywallSubheadline,
  paywallValueProps,
} from '../paywallCopy';

const signedIn: PaywallCopyContext = {
  featureName: 'Summit Log',
  isAuthenticated: true,
  isLifetimeSelected: false,
  hasSelection: true,
};

describe('paywallHeadline', () => {
  it('names the feature it was opened for', () => {
    expect(paywallHeadline('Summit Log')).toBe('Unlock Summit Log today');
  });

  it('speaks to the whole set when no feature prompted it', () => {
    expect(paywallHeadline(null)).toBe('Unlock access to all our exclusive features');
  });
});

describe('paywallSubheadline', () => {
  it('explains why the viewer was stopped, on a feature paywall', () => {
    expect(paywallSubheadline('Summit Log')).toContain('early access');
  });

  it('names the offer when opened from Settings', () => {
    expect(paywallSubheadline(null)).toContain('Pro members');
  });
});

describe('paywallCtaLabel', () => {
  it('routes a guest to sign-in rather than promising a purchase', () => {
    expect(paywallCtaLabel({ ...signedIn, isAuthenticated: false })).toBe('Sign In to Subscribe');
  });

  it('names a lifetime purchase as a purchase, not a subscription', () => {
    expect(paywallCtaLabel({ ...signedIn, isLifetimeSelected: true })).toBe('Buy Lifetime Access');
  });

  it('uses the standard App Store CTA for a subscription', () => {
    expect(paywallCtaLabel(signedIn)).toBe('Continue');
  });

  it('stays live while no plan is selected yet', () => {
    expect(paywallCtaLabel({ ...signedIn, hasSelection: false })).toBe('Continue');
  });

  it('prefers the guest label over the lifetime one', () => {
    // A guest cannot buy anything, lifetime included, so the sign-in label wins.
    expect(paywallCtaLabel({ ...signedIn, isAuthenticated: false, isLifetimeSelected: true })).toBe(
      'Sign In to Subscribe',
    );
  });
});

describe('paywallFinePrint', () => {
  it('warns a guest that the next tap goes to sign-in', () => {
    expect(paywallFinePrint({ ...signedIn, isAuthenticated: false })).toContain('sign in first');
  });

  it('says a lifetime purchase does not renew', () => {
    expect(paywallFinePrint({ ...signedIn, isLifetimeSelected: true })).toBe(
      'One payment. No subscription.',
    );
  });

  it('says how to get out of a subscription', () => {
    expect(paywallFinePrint(signedIn)).toBe('Auto-renews until cancelled. Cancel anytime.');
  });
});

describe('paywallValueProps', () => {
  it('names the other early-access features first, on a feature paywall', () => {
    const props = paywallValueProps('Summit Log', ['Wildlife ID', 'Trail Conditions']);
    expect(props[0]?.title).toBe('Everything else in early access');
    expect(props[0]?.detail).toBe('Wildlife ID · Trail Conditions');
  });

  it('omits the list when nothing else is in early access', () => {
    const props = paywallValueProps('Summit Log', []);
    expect(props.map((p) => p.title)).not.toContain('Everything else in early access');
  });

  it('omits the list from Settings, where the headline already covers it', () => {
    const props = paywallValueProps(null, ['Wildlife ID']);
    expect(props.map((p) => p.title)).not.toContain('Everything else in early access');
  });

  it('always makes the three standing arguments for Pro', () => {
    for (const featureName of ['Summit Log', null]) {
      const titles = paywallValueProps(featureName, []).map((p) => p.title);
      expect(titles).toContain('Try new features weeks before everyone else');
      expect(titles).toContain('You’re supporting a small team');
      expect(titles).toContain('Cancel anytime');
    }
  });
});

/**
 * ADR-005: nothing on the paywall may state or imply that waiting is an option.
 * This has regressed twice — first as a countdown badge, then as a value-prop
 * line reading "each one opens up to all users later". Both were accurate and
 * both told a reader they could have the thing by doing nothing.
 *
 * Asserted over every string the module can produce, so a new one cannot
 * reintroduce the argument without failing here.
 */
describe('ADR-005 — the paywall never argues for waiting', () => {
  const everyString = (): string[] => {
    const strings: string[] = [];
    for (const featureName of ['Summit Log', null]) {
      strings.push(paywallHeadline(featureName), paywallSubheadline(featureName));
      for (const prop of paywallValueProps(featureName, ['Wildlife ID'])) {
        strings.push(prop.title, prop.detail);
      }
      for (const isAuthenticated of [true, false]) {
        for (const isLifetimeSelected of [true, false]) {
          for (const hasSelection of [true, false]) {
            const context = { featureName, isAuthenticated, isLifetimeSelected, hasSelection };
            strings.push(paywallCtaLabel(context), paywallFinePrint(context));
          }
        }
      }
    }
    return strings;
  };

  // Phrasings that tell a reader the feature becomes free if they hold off.
  const FORBIDDEN = [
    /free for everyone/i,
    /free to everyone/i,
    /opens? up to all users/i,
    /available to everyone (in|on|after)/i,
    /\bdays? (left|remaining|until)\b/i,
    /ahead of everyone else\b.*\bdays\b/i,
    /graduat/i,
    /\bwait(ing)? (for|until)\b/i,
  ];

  it('never promises the feature becomes free, in either framing', () => {
    for (const text of everyString()) {
      for (const pattern of FORBIDDEN) {
        expect(text, `"${text}" argues for waiting`).not.toMatch(pattern);
      }
    }
  });

  it('never puts a number of days in front of someone deciding whether to pay', () => {
    for (const text of everyString()) {
      expect(text, `"${text}" contains a countdown`).not.toMatch(/\d+\s*(day|week|month)s?\b/i);
    }
  });
});
