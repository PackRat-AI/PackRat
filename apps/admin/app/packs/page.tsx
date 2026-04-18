import { PageHeader } from 'admin-app/components/page-header';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Packs' };

export default function PacksPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Packs" description="Browse and manage gear packs" />
      <p className="text-sm text-muted-foreground">Coming soon.</p>
    </div>
  );
}
