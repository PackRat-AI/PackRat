import { SidebarInset, SidebarProvider } from '@packrat/web-ui/components/sidebar';
import type React from 'react';
import { AppSidebar } from 'admin-app/components/app-sidebar';
import { AuthGuard } from 'admin-app/components/auth-guard';
import { DashboardHeader } from 'admin-app/components/dashboard-header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <DashboardHeader />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
}
