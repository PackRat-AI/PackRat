import { PageHeader } from 'admin-app/components/page-header';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="Settings" description="Admin configuration" />
      <p className="text-sm text-muted-foreground">Coming soon.</p>
    </div>
  );
}
