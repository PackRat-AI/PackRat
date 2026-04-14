import { type LucideIcon, LayoutDashboard, Package, Backpack, Users } from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
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
    title: 'Catalog',
    href: '/dashboard/catalog',
    icon: Package,
  },
];
