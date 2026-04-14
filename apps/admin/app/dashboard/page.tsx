import type { Metadata } from 'next';
import { DashboardContent } from 'admin-app/components/dashboard/dashboard-content';
import { PageHeader } from 'admin-app/components/page-header';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Dashboard"
        description="Platform overview and key metrics"
      />
      <DashboardContent />
    </div>
  );
}
