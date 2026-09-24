import type { OverallCondition, TrailSurface } from '../types';

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
  /** Foreground colour class, used for the icon and label. */
  textClassName: string;
  /** Translucent background for the badge capsule, matching SwiftUI's `.opacity(0.12)` fill. */
  backgroundClassName: string;
}

const CONDITION_DISPLAY = Object.freeze({
  excellent: {
    icon: 'check-circle',
    textClassName: 'text-green-600 dark:text-green-400',
    backgroundClassName: 'bg-green-500/10',
  },
  good: {
    icon: 'check-circle-outline',
    textClassName: 'text-blue-600 dark:text-blue-400',
    backgroundClassName: 'bg-blue-500/10',
  },
  fair: {
    icon: 'alert-circle-outline',
    textClassName: 'text-amber-600 dark:text-amber-400',
    backgroundClassName: 'bg-amber-500/10',
  },
  poor: {
    icon: 'close-circle',
    textClassName: 'text-red-600 dark:text-red-400',
    backgroundClassName: 'bg-red-500/10',
  },
} as const satisfies Record<OverallCondition, ConditionDisplay>);

const UNKNOWN_CONDITION_DISPLAY: ConditionDisplay = Object.freeze({
  icon: 'help-circle-outline',
  textClassName: 'text-muted-foreground',
  backgroundClassName: 'bg-muted',
});

export function conditionDisplay(condition: OverallCondition | string): ConditionDisplay {
  return CONDITION_DISPLAY[condition as OverallCondition] ?? UNKNOWN_CONDITION_DISPLAY;
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

export function surfaceIcon(surface: TrailSurface | string): string {
  return SURFACE_ICONS[surface as TrailSurface] ?? 'road';
}

/** `"downed trees"` → `"Downed trees"`, matching Swift's `.capitalized` on display. */
export function capitalizeFirst(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}
