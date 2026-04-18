import { CatalogAnalytics } from 'admin-app/components/analytics/catalog-analytics';
import { PageHeader } from 'admin-app/components/page-header';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Gear Catalog Analytics' };

export default function CatalogAnalyticsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Gear Catalog"
        description="Data lake statistics — brands, pricing, ETL pipeline, and embedding coverage"
      />
      <CatalogAnalytics />
    </div>
  );
}
