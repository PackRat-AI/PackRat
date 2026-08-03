import { isObject } from '@packrat/guards';
import { Platform } from 'react-native';
import colors from 'tailwindcss/colors';

// Matches expo-app/theme/colors.ts COLORS[colorScheme] shape.
type ThemeColors = {
  grey6: string;
  grey5: string;
  grey4: string;
  grey3: string;
  grey2: string;
  grey: string;
  yellow: string;
  green: string;
  background: string;
  foreground: string;
  root: string;
  card: string;
  destructive: string;
  primary: string;
};

type ParsedTextStyle = {
  fontWeight?:
    | 'normal'
    | 'bold'
    | '100'
    | '200'
    | '300'
    | '400'
    | '500'
    | '600'
    | '700'
    | '800'
    | '900';
  fontSize?: number;
  color?: string;
  textAlign?: 'left' | 'right' | 'center';
  letterSpacing?: number;
  lineHeight?: number;
};

const FONT_WEIGHT: Record<string, ParsedTextStyle['fontWeight']> = {
  'font-thin': '100',
  'font-extralight': '200',
  'font-light': '300',
  'font-normal': 'normal',
  'font-medium': '500',
  'font-semibold': '600',
  'font-bold': 'bold',
  'font-extrabold': '800',
  'font-black': '900',
};

const FONT_SIZE: Record<string, number> = {
  'text-xs': 12,
  'text-sm': 14,
  'text-base': 16,
  'text-lg': 18,
  'text-xl': 20,
  'text-2xl': 24,
  'text-3xl': 30,
  'text-4xl': 36,
  'text-5xl': 48,
  'text-6xl': 60,
  'text-7xl': 72,
  'text-8xl': 96,
  'text-9xl': 128,
};

// Tailwind's tracking-* scale is in em; converted against the resolved font size at parse time.
const LETTER_SPACING_EM: Record<string, number> = {
  'tracking-tighter': -0.05,
  'tracking-tight': -0.025,
  'tracking-normal': 0,
  'tracking-wide': 0.025,
  'tracking-wider': 0.05,
  'tracking-widest': 0.1,
};

// Tailwind's leading-* keyword scale is a unitless multiple of the font size.
const LINE_HEIGHT_RATIO: Record<string, number> = {
  'leading-none': 1,
  'leading-tight': 1.25,
  'leading-snug': 1.375,
  'leading-normal': 1.5,
  'leading-relaxed': 1.625,
  'leading-loose': 2,
};

// leading-<n> is n * 0.25rem (4px) in Tailwind's spacing scale.
const LEADING_STEP = /^leading-(\d+(?:\.\d+)?)$/;
// Arbitrary values: text-[15px], leading-[14px], tracking-[0.5px].
const ARBITRARY_PX = /^\[(-?\d+(?:\.\d+)?)(?:px)?\]$/;
const REM_PX = 16;

const TEXT_ALIGN: Record<string, ParsedTextStyle['textAlign']> = {
  'text-left': 'left',
  'text-right': 'right',
  'text-center': 'center',
};

// Semantic theme tokens (rely on the live-resolved `colors` from useColorScheme, not a hex constant).
const THEME_COLOR_KEY: Record<string, keyof ThemeColors> = {
  'text-foreground': 'foreground',
  'text-primary': 'primary',
  'text-muted-foreground': 'grey',
  'text-destructive': 'destructive',
};

// *-foreground tokens are white in both themes (see apps/expo/global.css) — not present in
// expo-app/theme/colors.ts's COLORS object, so resolved as a fixed value instead.
const FIXED_COLOR: Record<string, string> = {
  'text-primary-foreground': '#FFFFFF',
  'text-secondary-foreground': '#FFFFFF',
  'text-destructive-foreground': '#FFFFFF',
  // Shadeless palette colors: `text-white`/`text-black` have no numeric shade, so the
  // TEXT_COLOR_CLASS regex below never matched them and they fell through to Host, where they
  // could not reach the native text at all — white-on-primary labels rendered in body color.
  'text-white': '#FFFFFF',
  'text-black': '#000000',
  'text-transparent': 'transparent',
};

type TailwindPalette = typeof colors;

const TEXT_COLOR_CLASS = /^text-([a-z]+)-(\d{2,3})$/;

function resolveTailwindPaletteColor(className: string): string | undefined {
  const match = className.match(TEXT_COLOR_CLASS);
  if (!match) return undefined;
  const [, family, shade] = match;
  if (!family || !shade) return undefined;
  // safe-cast: `family` is a regex capture group (arbitrary string), not statically known to be
  // a real Tailwind color family — indexing widens it to the palette's key type on purpose;
  // the isObject guard below is what actually makes this safe at runtime.
  const palette = colors[family as keyof TailwindPalette];
  if (!palette || !isObject(palette)) return undefined;
  // safe-cast: same reasoning as above, but for `shade` against the now-narrowed palette object —
  // TS can't prove an arbitrary string key maps to `string`, only that the object shape allows it.
  return (palette as Record<string, string>)[shade];
}

// Classes that give Yoga an explicit sizing signal for the Host box (stretch/grow/fixed
// dimensions). When none of these are present, Host has nothing to size itself by and
// collapses to zero height — matchContents is needed so it sizes to its native content instead.
// The two are mutually exclusive: matchContents fights flex-1 (see button.tsx/text.tsx comments).
const SIZING_CLASS = /^(flex-1|flex-auto|flex-grow|self-stretch|w-|h-|min-w-|min-h-)/;

function hasExplicitSizing(tokens: string[]): boolean {
  // Variant-prefixed sizing counts too: `android:h-14` is still an explicit height on the
  // platform that matters. Testing the raw token missed those, so a prefixed-only sizing class
  // let the Host shrink-wrap and silently lose the declared dimension (e.g. SearchInput's pill).
  return tokens.some((token) => SIZING_CLASS.test(stripVariantPrefix(token)));
}

const WHITESPACE = /\s+/;

// NativeWind/Tailwind variant prefixes are colon-separated and may stack (dark:ios:text-sm).
const VARIANT_PREFIX = /^(?:[a-z][a-z0-9-]*:)+/;

function stripVariantPrefix(token: string): string {
  return token.replace(VARIANT_PREFIX, '');
}

const PLATFORM_VARIANTS = new Set(['ios', 'android', 'web']);

/**
 * True when a token is scoped to a platform we are not running on (`ios:text-foreground` on
 * Android). Those must not be reported as styling this text.
 *
 * `Text` no longer renders through `Host`; it is a plain RN `Text`, and it uses this parser only
 * to detect *which* properties `className` already sets so its variant/color defaults fill the
 * gaps. Resolving a foreign-platform class therefore makes `Text` suppress its own themed color
 * and hand responsibility to NativeWind — which correctly declines to apply an `ios:` class on
 * Android. Nothing sets a color, RN falls back to black, and the label is invisible on a dark
 * background. That is the "Continue with Google" label on the auth screen, measured on-device at
 * standard deviation 0 across its own text rect.
 */
function isForeignPlatformToken(token: string): boolean {
  const prefix = VARIANT_PREFIX.exec(token)?.[0];
  if (!prefix) return false;
  return prefix
    .slice(0, -1)
    .split(':')
    .some((variant) => PLATFORM_VARIANTS.has(variant) && variant !== Platform.OS);
}

type ParsedValueToken =
  | { kind: 'color'; value: string }
  | { kind: 'fontSize'; value: number }
  | { kind: 'lineHeight'; value: number }
  | { kind: 'letterSpacing'; value: number };

/**
 * Handles the value-carrying utilities that can't live in a lookup table: the Tailwind palette
 * (`text-red-500`), arbitrary values (`text-[15px]`, `leading-[14px]`), opacity modifiers
 * (`text-foreground/70`), and the numeric leading scale (`leading-6`).
 */
function parseValueToken({
  token,
  themeColors,
}: {
  token: string;
  themeColors: ThemeColors;
}): ParsedValueToken | undefined {
  // Opacity modifier: text-foreground/70, text-red-500/50. RN colors accept 8-digit hex, so the
  // alpha is folded into the resolved color rather than dropped with the whole class.
  const slash = token.lastIndexOf('/');
  if (slash > 0) {
    const base = token.slice(0, slash);
    const opacity = Number(token.slice(slash + 1));
    if (Number.isFinite(opacity) && opacity >= 0 && opacity <= 100) {
      const resolved = resolveColorToken({ token: base, themeColors });
      if (resolved) return { kind: 'color', value: withAlpha(resolved, opacity / 100) };
    }
    return undefined;
  }

  if (token.startsWith('text-')) {
    const value = token.slice('text-'.length);
    const px = value.match(ARBITRARY_PX);
    // text-[...] is ambiguous: a length is a font size, anything else (#fff, rgb(...)) is a color.
    if (px?.[1]) return { kind: 'fontSize', value: Number(px[1]) };
    if (value.startsWith('[') && value.endsWith(']')) {
      return { kind: 'color', value: value.slice(1, -1) };
    }
    const palette = resolveTailwindPaletteColor(token);
    if (palette) return { kind: 'color', value: palette };
    return undefined;
  }

  if (token.startsWith('leading-')) {
    const value = token.slice('leading-'.length);
    const px = value.match(ARBITRARY_PX);
    if (px?.[1]) return { kind: 'lineHeight', value: Number(px[1]) };
    const step = token.match(LEADING_STEP);
    if (step?.[1]) return { kind: 'lineHeight', value: Number(step[1]) * 0.25 * REM_PX };
    return undefined;
  }

  if (token.startsWith('tracking-')) {
    const px = token.slice('tracking-'.length).match(ARBITRARY_PX);
    if (px?.[1]) return { kind: 'letterSpacing', value: Number(px[1]) };
    return undefined;
  }

  return undefined;
}

function resolveColorToken({
  token,
  themeColors,
}: {
  token: string;
  themeColors: ThemeColors;
}): string | undefined {
  const themeKey = THEME_COLOR_KEY[token];
  if (themeKey) return themeColors[themeKey];
  if (token in FIXED_COLOR) return FIXED_COLOR[token];
  return resolveTailwindPaletteColor(token);
}

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Folds an alpha into a #rgb/#rrggbb color as 8-digit hex; passes anything else through. */
function withAlpha(color: string, alpha: number): string {
  const hex = color.match(HEX_COLOR);
  if (!hex?.[1]) return color;
  const full =
    hex[1].length === 3
      ? hex[1]
          .split('')
          .map((c) => c + c)
          .join('')
      : hex[1];
  const alphaHex = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${full}${alphaHex}`;
}

type HostMatchContents = boolean | { vertical?: boolean; horizontal?: boolean };

/**
 * For components with no textStyle escape hatch (e.g. Button) — matches both axes to content
 * when there's no explicit sizing class. A button should size to its label/icon by default,
 * not stretch to fill an arbitrary parent width.
 */
function shouldMatchContents(className: string | undefined): boolean {
  if (!className) return true;
  return !hasExplicitSizing(className.split(WHITESPACE).filter(Boolean));
}

/**
 * For Text. Two conflicting default needs, disambiguated by the caller's explicit `wrap` flag:
 * - `wrap: false` (default) — matches both axes to content, so short labels/badges/headings
 *   shrink-wrap to their own text width, same as the old NativeWindUI Text's default behavior.
 * - `wrap: true` — matches only the vertical axis, so the Host box keeps the parent's width
 *   constraint and paragraph/note text wraps at that width instead of overflowing unwrapped.
 * An explicit sizing class (flex-1, w-*, ...) always wins over either default.
 *
 * `alignsText` (text-center/text-left/text-right) behaves like `wrap` for sizing purposes:
 * aligning text inside a box that has been shrink-wrapped to that same text is a no-op, so a
 * centered heading rendered flush-left. Such a Text needs the parent's width to align within.
 */
function textMatchContents({
  hostClassName,
  wrap,
  alignsText,
}: {
  hostClassName: string | undefined;
  wrap: boolean;
  alignsText: boolean;
}): HostMatchContents {
  const hasSizing = hostClassName
    ? hasExplicitSizing(hostClassName.split(WHITESPACE).filter(Boolean))
    : false;
  // An explicit sizing class always wins — Yoga sizes the box, nothing matches to content.
  if (hasSizing) return false;
  return wrap || alignsText ? { vertical: true } : true;
}

/**
 * Splits a NativeWind className string into text-only styling (font weight/size/color/align —
 * applied to the @expo/ui Host's textStyle, since Host's className interop only reaches the
 * box, never the native-bridged text inside) and everything else (kept as className on Host).
 */
function splitTextClassName({
  className,
  themeColors,
  wrap,
  baseFontSize,
}: {
  className: string | undefined;
  themeColors: ThemeColors;
  wrap: boolean;
  /**
   * The font size in effect before classes are applied (i.e. the variant's). The `tracking-`
   * and `leading-` scales are relative units, so they need this to resolve; an explicit
   * `text-<size>` class in the same className wins over it.
   */
  baseFontSize: number;
}): {
  textStyle: ParsedTextStyle;
  hostClassName: string | undefined;
  matchContents: HostMatchContents;
  /** wrap:true with no explicit sizing class needs a fallback width — Host has nothing to wrap
   * text against otherwise, since the parent may not stretch it (e.g. `items-center`). */
  needsExplicitWidth: boolean;
} {
  if (!className) {
    return {
      textStyle: {},
      hostClassName: undefined,
      matchContents: textMatchContents({ hostClassName: undefined, wrap, alignsText: false }),
      needsExplicitWidth: wrap,
    };
  }

  const textStyle: ParsedTextStyle = {};
  const hostTokens: string[] = [];
  // tracking-*/leading-* are relative to the font size, which may be set by a later token —
  // resolve them after the whole class list has been walked.
  let pendingLetterSpacingEm: number | undefined;
  let pendingLineHeightRatio: number | undefined;

  for (const rawToken of className.split(WHITESPACE).filter(Boolean)) {
    // NativeWind variant prefixes (dark:, ios:, android:, web:, active:, ...). Non-platform
    // variants are still applied unconditionally: NativeWind resolves them for real, and
    // over-reporting a `dark:` colour only costs us a default we did not need. A *platform*
    // variant for another platform is different — see isForeignPlatformToken.
    if (isForeignPlatformToken(rawToken)) continue;
    const token = stripVariantPrefix(rawToken);
    if (token in FONT_WEIGHT) {
      textStyle.fontWeight = FONT_WEIGHT[token];
    } else if (token in FONT_SIZE) {
      textStyle.fontSize = FONT_SIZE[token];
    } else if (token in TEXT_ALIGN) {
      textStyle.textAlign = TEXT_ALIGN[token];
    } else if (token in THEME_COLOR_KEY) {
      const themeKey = THEME_COLOR_KEY[token];
      if (themeKey) textStyle.color = themeColors[themeKey];
    } else if (token in FIXED_COLOR) {
      textStyle.color = FIXED_COLOR[token];
    } else if (token in LETTER_SPACING_EM) {
      pendingLetterSpacingEm = LETTER_SPACING_EM[token];
    } else if (token in LINE_HEIGHT_RATIO) {
      pendingLineHeightRatio = LINE_HEIGHT_RATIO[token];
    } else {
      const parsed = parseValueToken({ token, themeColors });
      if (parsed === undefined) {
        hostTokens.push(rawToken);
      } else if (parsed.kind === 'color') {
        textStyle.color = parsed.value;
      } else if (parsed.kind === 'fontSize') {
        textStyle.fontSize = parsed.value;
      } else if (parsed.kind === 'lineHeight') {
        textStyle.lineHeight = parsed.value;
      } else {
        textStyle.letterSpacing = parsed.value;
      }
    }
  }

  const resolvedFontSize = textStyle.fontSize ?? baseFontSize;
  if (pendingLetterSpacingEm !== undefined) {
    textStyle.letterSpacing = pendingLetterSpacingEm * resolvedFontSize;
  }
  if (pendingLineHeightRatio !== undefined) {
    textStyle.lineHeight = pendingLineHeightRatio * resolvedFontSize;
  }

  const hostClassName = hostTokens.length > 0 ? hostTokens.join(' ') : undefined;
  const alignsText = textStyle.textAlign !== undefined;
  return {
    textStyle,
    hostClassName,
    matchContents: textMatchContents({ hostClassName, wrap, alignsText }),
    // Both wrap and text-align need a definite width: matchContents:{vertical:true} only stops
    // the Host shrink-wrapping, it doesn't hand SwiftUI/Compose a width to wrap or align against
    // (a parent using items-center never stretches it).
    needsExplicitWidth: (wrap || alignsText) && !hasExplicitSizing(hostTokens),
  };
}

export { shouldMatchContents, splitTextClassName };
export type { HostMatchContents, ParsedTextStyle };
