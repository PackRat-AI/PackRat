'use client';
import {
  Backpack,
  Bell,
  BookOpen,
  Bot,
  Home,
  Map as MapIcon,
  MessageSquare,
  User,
  Users,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { BetaBadge } from 'web-app/components/beta-badge';
import { NotificationsPanel } from 'web-app/components/modals';
import { WeightToggle } from 'web-app/components/weight-toggle';
import { cn } from 'web-app/lib/utils';

export type Screen =
  | 'home'
  | 'packs'
  | 'catalog'
  | 'feed'
  | 'trips'
  | 'profile'
  | 'ai'
  | 'messages'
  | 'weather'
  | 'guides'
  | 'gear-inventory'
  | 'shopping-list'
  | 'season-suggestions'
  | 'trail-conditions'
  | 'wildlife';

interface NavItem {
  id: Screen;
  label: string;
  icon: React.ElementType;
  beta?: boolean;
}

const mainNav: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'packs', label: 'Packs', icon: Backpack },
  { id: 'catalog', label: 'Catalog', icon: BookOpen },
  { id: 'feed', label: 'Feed', icon: Users },
  { id: 'trips', label: 'Trips', icon: MapIcon, beta: true },
  { id: 'profile', label: 'Profile', icon: User },
];

interface AppShellProps {
  children: (args: { screen: Screen; navigate: (s: Screen) => void }) => React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [screen, setScreen] = useState<Screen>('home');
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-56 lg:w-64 shrink-0 bg-[#1c1c1e] border-r border-border">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary shrink-0">
            <Backpack className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-[17px] tracking-tight text-foreground">PackRat</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {mainNav.map((item) => (
            <SidebarNavItem
              key={item.id}
              item={item}
              active={screen === item.id}
              onClick={() => setScreen(item.id)}
            />
          ))}

          <div className="mt-4 px-3 mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              More
            </p>
          </div>
          <SidebarNavItem
            item={{ id: 'ai', label: 'AI Assistant', icon: Bot }}
            active={screen === 'ai'}
            onClick={() => setScreen('ai')}
          />
          <SidebarNavItem
            item={{ id: 'messages', label: 'Messages', icon: MessageSquare }}
            active={screen === 'messages'}
            onClick={() => setScreen('messages')}
          />
          <SidebarNavItem
            item={{ id: 'guides', label: 'Guides', icon: BookOpen }}
            active={screen === 'guides'}
            onClick={() => setScreen('guides')}
          />
        </nav>

        {/* Bottom actions */}
        <div className="px-4 py-4 border-t border-border space-y-2">
          <button
            type="button"
            onClick={() => setShowNotifications(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Bell className="h-[18px] w-[18px] shrink-0" />
            <span className="flex-1 text-left">Notifications</span>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              3
            </span>
          </button>
          <WeightToggle className="w-full justify-center" />
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 pt-12 pb-3 bg-background border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Backpack className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-[16px] tracking-tight">PackRat</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNotifications(true)}
              className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
            </button>
            <WeightToggle />
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">{children({ screen, navigate: setScreen })}</div>

        {/* Notifications Panel */}
        <NotificationsPanel open={showNotifications} onClose={() => setShowNotifications(false)} />

        {/* Mobile bottom tab bar */}
        <nav
          className="md:hidden flex shrink-0 bg-[#1c1c1e] border-t border-border"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {mainNav.map((item) => (
            <BottomTabItem
              key={item.id}
              item={item}
              active={screen === item.id}
              onClick={() => setScreen(item.id)}
            />
          ))}
        </nav>
      </main>
    </div>
  );
}

function SidebarNavItem({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mb-0.5',
        active
          ? 'bg-primary/20 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.5 : 2} />
      <span className="flex-1 text-left">{item.label}</span>
      {item.beta && <BetaBadge />}
    </button>
  );
}

function BottomTabItem({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1 transition-colors',
        active ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.5 : 2} />
      <span className="text-[10px] font-medium">{item.label}</span>
      {item.beta && <span className="absolute top-1 text-[8px] text-primary font-bold">•</span>}
    </button>
  );
}
