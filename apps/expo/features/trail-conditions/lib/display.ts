import { makeEnumGuard } from '@packrat/guards';
import type { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import {
  OVERALL_CONDITIONS,
  type OverallCondition,
  TRAIL_SURFACES,
  type TrailSurface,
} from '../types';

type ThemeColors = ReturnType<typeof useColorScheme>['colors'];

/**
 * Display metadata for a report's overall condition, mirroring the `conditionColor` and
 * `conditionSymbol` extensions on `TrailConditionReport` in `Models/TrailCondition.swift`.
 *
 * The Swift app names SF Symbols and semantic SwiftUI colours; here the same four states map to
 * Material icon names and Tailwind classes. The *states* and their meaning are the parity
 * contract — the icon set is necessarily per-platform.
 */
interface ConditionDisplay {
  /** Material Community icon name, the Android counterpart of the SF Symbol. */
  icon: string;
  /**
   * Icon tint. A function of the theme rather than a literal because the icon takes a colour
   * value while the label takes a class, and both must name the same state.
   */
  iconColor: (colors: ThemeColors) => string;
  /** Foreground colour class, used for the icon and label. */
  textClassName: string;
  /** Translucent background for the badge capsule, matching SwiftUI's `.opacity(0.12)` fill. */
  backgroundClassName: string;
}

const CONDITION_DISPLAY = Object.freeze({
  excellent: {
    icon: 'check-circle',
    iconColor: (colors) => colors.green,
    textClassName: 'text-green-600 dark:text-green-400',
    backgroundClassName: 'bg-green-500/10',
  },
  good: {
    icon: 'check-circle-outline',
    // `fair` and `good` have theme tokens; amber-600 below matches the Tailwind class.
    iconColor: (colors) => colors.primary,
    textClassName: 'text-blue-600 dark:text-blue-400',
    backgroundClassName: 'bg-blue-500/10',
  },
  fair: {
    icon: 'alert-circle-outline',
    iconColor: () => '#d97706',
    textClassName: 'text-amber-600 dark:text-amber-400',
    backgroundClassName: 'bg-amber-500/10',
  },
  poor: {
    icon: 'close-circle',
    iconColor: (colors) => colors.destructive,
    textClassName: 'text-red-600 dark:text-red-400',
    backgroundClassName: 'bg-red-500/10',
  },
} as const satisfies Record<OverallCondition, ConditionDisplay>);

const UNKNOWN_CONDITION_DISPLAY: ConditionDisplay = Object.freeze({
  icon: 'help-circle-outline',
  iconColor: (colors) => colors.grey,
  textClassName: 'text-muted-foreground',
  backgroundClassName: 'bg-muted',
});

const isOverallCondition = makeEnumGuard(OVERALL_CONDITIONS);

export function conditionDisplay(condition: OverallCondition | string): ConditionDisplay {
  return isOverallCondition(condition) ? CONDITION_DISPLAY[condition] : UNKNOWN_CONDITION_DISPLAY;
}

/** Surface icons, mirroring the `symbol` property on Swift's `TrailSurface` enum. */
const SURFACE_ICONS = Object.freeze({
  paved: 'road',
  gravel: 'dots-horizontal',
  dirt: 'leaf',
  rocky: 'image-filter-hdr',
  snow: 'snowflake',
  mud: 'water',
} as const satisfies Record<TrailSurface, string>);

const isTrailSurface = makeEnumGuard(TRAIL_SURFACES);

export function surfaceIcon(surface: TrailSurface | string): string {
  return isTrailSurface(surface) ? SURFACE_ICONS[surface] : 'road';
}

/** `"downed trees"` → `"Downed trees"`, matching Swift's `.capitalized` on display. */
export function capitalizeFirst(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}
