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
import { CreateFeatureAccessDialog } from 'admin-app/components/create-feature-access-dialog';
import { DeleteButton } from 'admin-app/components/delete-button';
import { EditFeatureAccessDialog } from 'admin-app/components/edit-feature-access-dialog';
import {
  type AdminFeatureAccessItem,
  deleteFeatureAccessRow,
  getFeatureAccess,
} from 'admin-app/lib/api';
import { formatDate } from 'admin-app/lib/date';
import { queryKeys } from 'admin-app/lib/queryKeys';

function TableSkeleton() {
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <div className="h-10 bg-muted/30 border-b border-border/60" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={`skeleton-row-${i}`}
          className="flex gap-4 px-4 py-3 border-b border-border/30 last:border-0"
        >
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

function FeatureAccessRow({ item }: { item: AdminFeatureAccessItem }) {
  const queryClient = useQueryClient();

  const { mutateAsync: handleDelete } = useMutation({
    mutationFn: () => deleteFeatureAccessRow(item.key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.featureAccess.all() });
    },
  });

  const until = item.earlyAccessUntil ? new Date(item.earlyAccessUntil) : null;
  const isInEarlyAccess = until !== null && until.getTime() > Date.now();

  return (
    <TableRow className="hover:bg-muted/20">
      <TableCell>
        <p className="text-sm font-medium font-mono">{item.key}</p>
      </TableCell>
      <TableCell>
        <p className="text-sm">{item.label}</p>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-xs">
            {item.description}
          </p>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={isInEarlyAccess ? 'default' : 'secondary'} className="text-xs">
          {isInEarlyAccess ? 'In early access' : 'Free for everyone'}
        </Badge>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">{until ? formatDate(until) : '—'}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <EditFeatureAccessDialog item={item} />
          <DeleteButton
            label={item.key}
            description="The feature becomes fully ungated for everyone — this cannot be undone from here."
            onConfirm={async () => {
              await handleDelete();
            }}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function FeatureAccessPage() {
  const {
    data: items,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.admin.featureAccess.all(),
    queryFn: getFeatureAccess,
  });

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Entitlements</h2>
          <p className="text-muted-foreground text-sm mt-1">
            The RevenueCat early-access paywall config. A feature is Pro-gated until its window
            passes, then becomes free for everyone automatically.
          </p>
        </div>
        <CreateFeatureAccessDialog />
      </div>
      {isError ? (
        <p className="text-sm text-destructive py-4">
          Failed to load entitlements. Check that the API is reachable.
        </p>
      ) : isLoading ? (
        <TableSkeleton />
      ) : (
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-medium text-xs uppercase tracking-wide">Key</TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-wide">Label</TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-wide">
                  Status
                </TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-wide">
                  Early access until
                </TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-wide w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(items ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No entitlements configured.
                  </TableCell>
                </TableRow>
              ) : (
                (items ?? []).map((item) => <FeatureAccessRow key={item.key} item={item} />)
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
