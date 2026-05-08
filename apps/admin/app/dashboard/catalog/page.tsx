'use client';

import { Badge } from '@packrat/web-ui/components/badge';
import { Button } from '@packrat/web-ui/components/button';
import { Skeleton } from '@packrat/web-ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@packrat/web-ui/components/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DeleteButton } from 'admin-app/components/delete-button';
import { EditCatalogDialog } from 'admin-app/components/edit-catalog-dialog';
import { RawObjectDialog } from 'admin-app/components/raw-object-dialog';
import { SearchInput } from 'admin-app/components/search-input';
import { usePaginatedSearch } from 'admin-app/hooks/use-paginated-search';
import { type AdminCatalogItem, deleteCatalogItem, getCatalogItems } from 'admin-app/lib/api';
import { formatDate } from 'admin-app/lib/date';
import { queryKeys } from 'admin-app/lib/queryKeys';
import { ChevronLeft, ChevronRight, ExternalLink, Star } from 'lucide-react';
import Image from 'next/image';

const PAGE_SIZE = 50;

function TableSkeleton() {
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <div className="h-10 bg-muted/30 border-b border-border/60" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={`skeleton-row-${i}`}
          className="flex gap-4 px-4 py-3 border-b border-border/30 last:border-0"
        >
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

function availabilityColor(availability: string | null) {
  if (availability === 'InStock') return 'text-green-500';
  if (availability === 'OutOfStock') return 'text-destructive';
  return 'text-muted-foreground';
}

function CatalogRow({ item }: { item: AdminCatalogItem }) {
  const queryClient = useQueryClient();

  const { mutateAsync: handleDelete } = useMutation({
    mutationFn: () => deleteCatalogItem(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.catalog.all() });
    },
  });

  const thumbUrl = item.images?.[0] ?? null;

  return (
    <TableRow className="hover:bg-muted/20">
      <TableCell>
        <div className="flex items-start gap-2.5">
          {thumbUrl ? (
            <Image
              src={thumbUrl}
              alt=""
              width={40}
              height={40}
              className="rounded object-cover shrink-0 bg-muted"
            />
          ) : (
            <div className="h-10 w-10 rounded bg-muted shrink-0" />
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium">{item.name}</p>
              {item.productUrl && (
                <a
                  href={item.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {item.brand && <span className="text-xs text-muted-foreground">{item.brand}</span>}
              {item.model && <span className="text-xs text-muted-foreground/60">{item.model}</span>}
            </div>
            {item.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {item.description}
              </p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        {item.categories?.length ? (
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
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {item.weight ? `${item.weight} ${item.weightUnit}` : '—'}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {item.price != null
            ? `${item.currency && item.currency !== 'USD' ? `${item.currency} ` : '$'}${item.price.toFixed(2)}`
            : '—'}
        </span>
      </TableCell>
      <TableCell>
        <div className="space-y-0.5">
          <span className={`text-xs font-medium ${availabilityColor(item.availability)}`}>
            {item.availability ?? '—'}
          </span>
          {item.ratingValue != null && (
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="text-xs text-muted-foreground">
                {item.ratingValue.toFixed(1)}
                {item.reviewCount != null && ` (${item.reviewCount})`}
              </span>
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {item.createdAt ? formatDate(new Date(item.createdAt)) : '—'}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <RawObjectDialog label={`item:${item.id}`} data={item} />
          <EditCatalogDialog item={item} />
          <DeleteButton
            label={item.name}
            description="This catalog item will be permanently deleted."
            onConfirm={async () => {
              await handleDelete();
            }}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function CatalogPage() {
  const { q, setSearch, page, setPage } = usePaginatedSearch();
  const offset = page * PAGE_SIZE;

  const {
    data: items = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.admin.catalog.list({ q: q || undefined, page }),
    queryFn: () => getCatalogItems({ q: q || undefined, limit: PAGE_SIZE, offset }),
  });

  const hasPrev = page > 0;
  const hasNext = items.length === PAGE_SIZE;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Catalog</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Manage gear items in the PackRat catalog.
        </p>
      </div>
      <div className="space-y-4">
        <SearchInput placeholder="Search by name, brand, or category…" onSearch={setSearch} />
        {isError ? (
          <p className="text-sm text-destructive py-4">
            Failed to load catalog. Check that the API is reachable.
          </p>
        ) : isLoading ? (
          <TableSkeleton />
        ) : (
          <>
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-medium text-xs uppercase tracking-wide">
                      Item
                    </TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wide">
                      Categories
                    </TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wide">
                      Weight
                    </TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wide">
                      Price
                    </TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wide">
                      Status
                    </TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wide">
                      Added
                    </TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wide w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No catalog items found{q ? ` matching "${q}"` : ''}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => <CatalogRow key={item.id} item={item} />)
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {items.length === 0
                  ? `No items${q ? ` matching "${q}"` : ''}`
                  : `${(offset + 1).toLocaleString()}–${(offset + items.length).toLocaleString()} items${q ? ` matching "${q}"` : ''}`}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={!hasPrev}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <span className="text-xs text-muted-foreground">Page {page + 1}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={!hasNext}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
