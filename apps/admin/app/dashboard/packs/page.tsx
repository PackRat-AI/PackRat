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
import { SearchInput } from 'admin-app/components/search-input';
import { type AdminPack, deletePack, getPacks } from 'admin-app/lib/api';
import { formatDate } from 'admin-app/lib/date';
import { useSearchParams } from 'next/navigation';

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
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-8" />
        </div>
      ))}
    </div>
  );
}

function PackRow({ pack }: { pack: AdminPack }) {
  const queryClient = useQueryClient();

  const { mutateAsync: handleDelete } = useMutation({
    mutationFn: () => deletePack(pack.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'packs'] });
    },
  });

  return (
    <TableRow className="hover:bg-muted/20">
      <TableCell>
        <div>
          <p className="text-sm font-medium">{pack.name}</p>
          {pack.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">{pack.description}</p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">{pack.userEmail ?? 'Unknown'}</span>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs">
          {pack.category || 'Uncategorized'}
        </Badge>
      </TableCell>
      <TableCell>
        <span
          className={`text-xs font-medium ${pack.isPublic ? 'text-green-500' : 'text-muted-foreground'}`}
        >
          {pack.isPublic ? 'Public' : 'Private'}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {pack.createdAt ? formatDate(new Date(pack.createdAt)) : '—'}
        </span>
      </TableCell>
      <TableCell>
        <DeleteButton
          label={pack.name}
          description="The pack will be soft-deleted and hidden from all users."
          onConfirm={async () => {
            await handleDelete();
          }}
        />
      </TableCell>
    </TableRow>
  );
}

export default function PacksPage() {
  const searchParams = useSearchParams();
  const q = searchParams?.get('q') ?? undefined;

  const {
    data: packs = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['admin', 'packs', q],
    queryFn: () => getPacks({ q }),
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Packs</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Browse and manage all packing lists on the platform.
        </p>
      </div>
      <div className="space-y-4">
        <SearchInput placeholder="Search by name, owner, or category…" />
        {isError ? (
          <p className="text-sm text-destructive py-4">
            Failed to load packs. Check that the API is reachable.
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
                      Pack
                    </TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wide">
                      Owner
                    </TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wide">
                      Category
                    </TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wide">
                      Visibility
                    </TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wide">
                      Created
                    </TableHead>
                    <TableHead className="font-medium text-xs uppercase tracking-wide w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No packs found{q ? ` matching "${q}"` : ''}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    packs.map((p) => <PackRow key={p.id} pack={p} />)
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              {packs.length.toLocaleString()} pack{packs.length !== 1 ? 's' : ''}
              {q ? ` matching "${q}"` : ''}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
