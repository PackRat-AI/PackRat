import { QueryMetricsAnalytics } from 'admin-app/components/analytics/query-metrics';
import { PageHeader } from 'admin-app/components/page-header';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Query Metrics' };

export default function QueryMetricsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Query Metrics"
        description="Persistent per-request compute and egress tracking — survives Neon compute restarts"
      />
      <QueryMetricsAnalytics />
    </div>
  );
}
