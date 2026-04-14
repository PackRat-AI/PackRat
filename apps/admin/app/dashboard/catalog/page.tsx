'use client';

import { Badge } from '@packrat/web-ui/components/badge';
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
import { SearchInput } from 'admin-app/components/search-input';
import { type AdminCatalogItem, deleteCatalogItem, getCatalogItems } from 'admin-app/lib/api';
import { formatDate } from 'admin-app/lib/date';
import { useSearchParams } from 'next/navigation';

function TableSkeleton() {
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <div className="h-10 bg-muted/30 border-b border-border/60" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b border-border/30 last:border-0">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

function CatalogRow({ item }: { item: AdminCatalogItem }) {
  const queryClient = useQueryClient();

  const { mutateAsync: handleDelete } = useMutation({
    mutationFn: () => deleteCatalogItem(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] });
    },
  });

  return (
    <TableRow className="hover:bg-muted/20">
      <TableCell>
        <div>
          <p className="text-sm font-medium">{item.name}</p>
          {item.brand && <p className="text-xs text-muted-foreground">{item.brand}</p>}
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
          {item.price != null ? `$${item.price.toFixed(2)}` : '—'}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {item.createdAt ? formatDate(new Date(item.createdAt)) : '—'}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
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
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? undefined;

  const {
    data: items = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['admin', 'catalog', q],
    queryFn: () => getCatalogItems({ q }),
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Catalog</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Manage gear items in the PackRat catalog.
        </p>
      </div>
      <div className="space-y-4">
        <SearchInput placeholder="Search by name, brand, or category…" />
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
                      Added
                    </TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wide w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No catalog items found{q ? ` matching "${q}"` : ''}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => <CatalogRow key={item.id} item={item} />)
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              {items.length.toLocaleString()} item{items.length !== 1 ? 's' : ''}
              {q ? ` matching "${q}"` : ''}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
