import { PageHeader } from 'admin-app/components/page-header';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Catalog Items' };

export default function CatalogPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Catalog Items" description="Browse the gear catalog data lake" />
      <p className="text-sm text-muted-foreground">Coming soon.</p>
    </div>
  );
}
