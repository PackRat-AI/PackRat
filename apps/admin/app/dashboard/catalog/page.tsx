import { Badge } from '@packrat/web-ui/components/badge';
import { Skeleton } from '@packrat/web-ui/components/skeleton';
import { Suspense } from 'react';
import { SearchableTable, type Column } from 'admin-app/components/searchable-table';
import { formatDate } from 'admin-app/lib/date';
import { getCatalogItems, type AdminCatalogItem } from 'admin-app/lib/api';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Catalog' };

const columns: Column<AdminCatalogItem>[] = [
  {
    key: 'name',
    header: 'Item',
    render: (item) => (
      <div>
        <p className="text-sm font-medium">{item.name}</p>
        {item.brand && (
          <p className="text-xs text-muted-foreground">{item.brand}</p>
        )}
      </div>
    ),
  },
  {
    key: 'categories',
    header: 'Categories',
    render: (item) =>
      item.categories?.length ? (
        <div className="flex flex-wrap gap-1">
          {item.categories.slice(0, 2).map((cat) => (
            <Badge key={cat} variant="outline" className="text-xs">
              {cat}
            </Badge>
          ))}
          {item.categories.length > 2 && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              +{item.categories.length - 2}
            </Badge>
          )}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">Uncategorized</span>
      ),
  },
  {
    key: 'weight',
    header: 'Weight',
    render: (item) => (
      <span className="text-sm text-muted-foreground">
        {item.weight ? `${item.weight} ${item.weightUnit}` : '—'}
      </span>
    ),
  },
  {
    key: 'price',
    header: 'Price',
    render: (item) => (
      <span className="text-sm text-muted-foreground">
        {item.price != null ? `$${item.price.toFixed(2)}` : '—'}
      </span>
    ),
  },
  {
    key: 'added',
    header: 'Added',
    render: (item) => (
      <span className="text-sm text-muted-foreground">
        {item.createdAt ? formatDate(new Date(item.createdAt)) : '—'}
      </span>
    ),
  },
];

async function CatalogContent() {
  const items = await getCatalogItems(100);
  return (
    <SearchableTable
      data={items}
      columns={columns}
      searchPlaceholder="Search by name, brand, or category…"
      emptyMessage="No catalog items found."
      getSearchText={(item) =>
        [item.name, item.brand, ...(item.categories ?? [])].filter(Boolean).join(' ')
      }
    />
  );
}

function CatalogSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-64" />
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <div className="h-10 bg-muted/30 border-b border-border/60" />
        {Array.from({ length: 8 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeletons
          <div key={i} className="flex gap-4 px-4 py-3 border-b border-border/30 last:border-0">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CatalogPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Catalog</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Manage gear items in the PackRat catalog.
        </p>
      </div>
      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogContent />
      </Suspense>
    </div>
  );
}
