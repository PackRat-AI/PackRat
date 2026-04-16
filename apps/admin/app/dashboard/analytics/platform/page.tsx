import { PlatformAnalytics } from 'admin-app/components/analytics/platform-analytics';
import { PageHeader } from 'admin-app/components/page-header';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Platform Analytics' };

export default function PlatformAnalyticsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Platform Analytics"
        description="User growth, content creation, and activity trends"
      />
      <PlatformAnalytics />
    </div>
  );
}
