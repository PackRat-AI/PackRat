import type { Metadata } from 'next';
import { PageHeader } from 'admin-app/components/page-header';

export const metadata: Metadata = { title: 'Users' };

export default function UsersPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Users" description="Manage platform users" />
      <p className="text-sm text-muted-foreground">Coming soon.</p>
    </div>
  );
}
