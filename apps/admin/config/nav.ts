import {
  Activity,
  Backpack,
  BarChart2,
  Database,
  LayoutDashboard,
  type LucideIcon,
  Map as MapIcon,
  Package,
  ShieldAlert,
  Sparkles,
  ToggleLeft,
  Unlock,
  Users,
} from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  /** Live count shown beside the item; the sidebar resolves it. */
  count?: 'pendingFeedReports';
}

export const navItems: NavItem[] = [
  {
    title: 'Overview',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Users',
    href: '/dashboard/users',
    icon: Users,
  },
  {
    title: 'Packs',
    href: '/dashboard/packs',
    icon: Backpack,
  },
  {
    title: 'Featured Packs',
    href: '/dashboard/featured-packs',
    icon: Sparkles,
  },
  {
    title: 'Moderation',
    href: '/dashboard/moderation',
    icon: ShieldAlert,
    count: 'pendingFeedReports',
  },
  {
    title: 'Catalog',
    href: '/dashboard/catalog',
    icon: Package,
  },
  {
    title: 'Trail Viewer',
    href: '/dashboard/trails',
    icon: MapIcon,
  },
  {
    title: 'Feature Flags',
    href: '/dashboard/feature-flags',
    icon: ToggleLeft,
  },
  {
    title: 'Entitlements',
    href: '/dashboard/feature-access',
    icon: Unlock,
  },
  {
    title: 'Platform Analytics',
    href: '/dashboard/analytics/platform',
    icon: Activity,
  },
  {
    title: 'Gear Catalog Analytics',
    href: '/dashboard/analytics/catalog',
    icon: BarChart2,
  },
  {
    title: 'Query Metrics',
    href: '/dashboard/analytics/query-metrics',
    icon: Database,
  },
];
