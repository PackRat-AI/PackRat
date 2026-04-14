import { Badge } from '@packrat/web-ui/components/badge';
import { Skeleton } from '@packrat/web-ui/components/skeleton';
import { Suspense } from 'react';
import { SearchableTable, type Column } from 'admin-app/components/searchable-table';
import { formatDate } from 'admin-app/lib/date';
import { getPacks, type AdminPack } from 'admin-app/lib/api';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Packs' };

const columns: Column<AdminPack>[] = [
  {
    key: 'name',
    header: 'Pack',
    render: (p) => (
      <div>
        <p className="text-sm font-medium">{p.name}</p>
        {p.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">{p.description}</p>
        )}
      </div>
    ),
  },
  {
    key: 'owner',
    header: 'Owner',
    render: (p) => (
      <span className="text-sm text-muted-foreground">{p.userEmail ?? 'Unknown'}</span>
    ),
  },
  {
    key: 'category',
    header: 'Category',
    render: (p) => (
      <Badge variant="outline" className="text-xs">
        {p.category || 'Uncategorized'}
      </Badge>
    ),
  },
  {
    key: 'visibility',
    header: 'Visibility',
    render: (p) => (
      <span className={`text-xs font-medium ${p.isPublic ? 'text-green-500' : 'text-muted-foreground'}`}>
        {p.isPublic ? 'Public' : 'Private'}
      </span>
    ),
  },
  {
    key: 'created',
    header: 'Created',
    render: (p) => (
      <span className="text-sm text-muted-foreground">
        {p.createdAt ? formatDate(new Date(p.createdAt)) : '—'}
      </span>
    ),
  },
];

async function PacksContent() {
  const packs = await getPacks(100);
  return (
    <SearchableTable
      data={packs}
      columns={columns}
      searchPlaceholder="Search by name, owner, or category…"
      emptyMessage="No packs found."
      getSearchText={(p) =>
        [p.name, p.description, p.userEmail, p.category].filter(Boolean).join(' ')
      }
    />
  );
}

function PacksSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-64" />
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <div className="h-10 bg-muted/30 border-b border-border/60" />
        {Array.from({ length: 8 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeletons
          <div key={i} className="flex gap-4 px-4 py-3 border-b border-border/30 last:border-0">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PacksPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Packs</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Browse and manage all packing lists on the platform.
        </p>
      </div>
      <Suspense fallback={<PacksSkeleton />}>
        <PacksContent />
      </Suspense>
    </div>
  );
}
