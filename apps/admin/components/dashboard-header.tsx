'use client';

import { Separator } from '@packrat/web-ui/components/separator';
import { SidebarTrigger } from '@packrat/web-ui/components/sidebar';
import { navItems } from 'admin-app/config/nav';
import { Moon, Sun } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';

function getPageTitle(pathname: string): string {
  const item = navItems.find((n) =>
    n.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(n.href),
  );
  return item?.title ?? 'Admin';
}

export function DashboardHeader() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />

      <h1 className="text-sm font-medium">{getPageTitle(pathname)}</h1>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center justify-center w-8 h-8 rounded-lg border bg-background
                     text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
