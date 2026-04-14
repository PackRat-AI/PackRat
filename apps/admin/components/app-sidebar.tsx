'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@packrat/web-ui/components/sidebar';
import { cn } from '@packrat/web-ui/lib/utils';
import { navItems } from 'admin-app/config/nav';
import { clearCredentials } from 'admin-app/lib/auth';
import { LogOut, Package } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  function handleLogout() {
    clearCredentials();
    router.replace('/login');
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <SidebarHeader className="h-14 flex items-center px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 shrink-0">
            <Package className="w-4 h-4 text-primary" />
          </div>
          {!isCollapsed && (
            <span className="font-semibold text-sm truncate text-sidebar-foreground">
              PackRat Admin
            </span>
          )}
        </Link>
      </SidebarHeader>

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : (pathname?.startsWith(item.href) ?? false);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={cn(
                        'transition-colors',
                        isActive && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
                      )}
                    >
                      <Link href={item.href}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <SidebarFooter className="pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip="Sign out"
              className="text-muted-foreground hover:text-foreground w-full"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
