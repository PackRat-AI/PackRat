import { describe, expect, it } from 'vitest';
import {
  bestValuePackage,
  defaultPackage,
  isLifetime,
  PACKAGE_TYPE,
  planBillingDetail,
  planTitle,
} from '../paywallPlans';

/**
 * A package carrying only the fields the plan helpers read.
 *
 * The helpers are typed against `PurchasesPackage`, whose real shape is a large
 * native-backed object. Rather than casting a partial literal through
 * `as unknown as PurchasesPackage`, the helpers are called through this
 * structural type — the same fields, named honestly — so the test asserts
 * against exactly what the functions read.
 */
interface PlanFields {
  identifier: string;
  packageType: string;
  product: { identifier: string; title: string; priceString: string };
}

function pkg(
  packageType: string,
  options: { identifier?: string; title?: string; priceString?: string } = {},
): PlanFields {
  return {
    identifier: options.identifier ?? `$rc_${packageType.toLowerCase()}`,
    packageType,
    product: {
      identifier: `product.${packageType.toLowerCase()}`,
      title: options.title ?? '',
      priceString: options.priceString ?? '$0.00',
    },
  };
}

describe('planTitle', () => {
  it("prefers the store's own localized title, so a rename needs no release", () => {
    expect(planTitle(pkg(PACKAGE_TYPE.annual, { title: 'PackRat Pro — Yearly' }))).toBe(
      'PackRat Pro — Yearly',
    );
  });

  it('ignores a blank or whitespace-only store title', () => {
    expect(planTitle(pkg(PACKAGE_TYPE.annual, { title: '   ' }))).toBe('Yearly');
  });

  it('falls back to our own name for the package type', () => {
    expect(planTitle(pkg(PACKAGE_TYPE.monthly))).toBe('Monthly');
    expect(planTitle(pkg(PACKAGE_TYPE.sixMonth))).toBe('6 Months');
    expect(planTitle(pkg(PACKAGE_TYPE.lifetime))).toBe('Lifetime');
  });

  it('falls back to the identifier for a type we do not name', () => {
    expect(planTitle(pkg('CUSTOM', { identifier: 'seasonal' }))).toBe('Seasonal');
  });

  it('returns an empty string rather than crashing on a nameless package', () => {
    // Should not happen, but a row with no name at all is preferable to a
    // paywall that throws while someone is trying to give us money.
    expect(planTitle(pkg('CUSTOM', { identifier: '' }))).toBe('');
  });
});

describe('planBillingDetail', () => {
  it('says how a recurring plan bills', () => {
    expect(planBillingDetail(pkg(PACKAGE_TYPE.annual))).toBe('Billed once a year');
    expect(planBillingDetail(pkg(PACKAGE_TYPE.monthly))).toBe('Billed monthly');
  });

  it('says a lifetime purchase is a one-off', () => {
    expect(planBillingDetail(pkg(PACKAGE_TYPE.lifetime))).toBe('One payment, yours for good');
  });

  it('says nothing where there is nothing worth saying', () => {
    expect(planBillingDetail(pkg(PACKAGE_TYPE.threeMonth))).toBeNull();
  });
});

describe('bestValuePackage', () => {
  it('picks the longest recurring plan — cheapest per month', () => {
    const packages = [pkg(PACKAGE_TYPE.monthly), pkg(PACKAGE_TYPE.annual)];
    expect(bestValuePackage(packages)?.packageType).toBe(PACKAGE_TYPE.annual);
  });

  it('walks down the ranking when the longer plans are absent', () => {
    const packages = [pkg(PACKAGE_TYPE.weekly), pkg(PACKAGE_TYPE.threeMonth)];
    expect(bestValuePackage(packages)?.packageType).toBe(PACKAGE_TYPE.threeMonth);
  });

  it('never marks lifetime best value — a different kind of purchase', () => {
    const packages = [pkg(PACKAGE_TYPE.lifetime), pkg(PACKAGE_TYPE.monthly)];
    expect(bestValuePackage(packages)?.packageType).toBe(PACKAGE_TYPE.monthly);
  });

  it('returns nothing when only lifetime is sold', () => {
    expect(bestValuePackage([pkg(PACKAGE_TYPE.lifetime)])).toBeUndefined();
  });

  it('returns nothing for an empty catalogue', () => {
    expect(bestValuePackage([])).toBeUndefined();
  });
});

describe('defaultPackage', () => {
  it('preselects the best-value plan', () => {
    const packages = [pkg(PACKAGE_TYPE.monthly), pkg(PACKAGE_TYPE.annual)];
    expect(defaultPackage(packages)?.packageType).toBe(PACKAGE_TYPE.annual);
  });

  it('still selects a row when the catalogue is only lifetime, so the CTA is live', () => {
    expect(defaultPackage([pkg(PACKAGE_TYPE.lifetime)])?.packageType).toBe(PACKAGE_TYPE.lifetime);
  });

  it('selects a row for a package type the ranking does not name', () => {
    expect(defaultPackage([pkg('CUSTOM')])?.packageType).toBe('CUSTOM');
  });

  it('has nothing to select for an empty catalogue', () => {
    expect(defaultPackage([])).toBeUndefined();
  });
});

describe('isLifetime', () => {
  it('identifies a one-off purchase', () => {
    expect(isLifetime(pkg(PACKAGE_TYPE.lifetime))).toBe(true);
    expect(isLifetime(pkg(PACKAGE_TYPE.annual))).toBe(false);
  });

  it('treats no selection as not lifetime', () => {
    expect(isLifetime(undefined)).toBe(false);
  });
});
