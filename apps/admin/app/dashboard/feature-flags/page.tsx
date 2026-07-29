'use client';

import { Badge } from '@packrat/web-ui/components/badge';
import { Button } from '@packrat/web-ui/components/button';
import { Skeleton } from '@packrat/web-ui/components/skeleton';
import { Switch } from '@packrat/web-ui/components/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@packrat/web-ui/components/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type AdminFeatureFlagItem,
  getFeatureFlags,
  resetFeatureFlag,
  upsertFeatureFlag,
} from 'admin-app/lib/api';
import { formatDate } from 'admin-app/lib/date';
import { queryKeys } from 'admin-app/lib/queryKeys';
import { RotateCcw } from 'lucide-react';

function TableSkeleton() {
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <div className="h-10 bg-muted/30 border-b border-border/60" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={`skeleton-row-${i}`}
          className="flex gap-4 px-4 py-3 border-b border-border/30 last:border-0"
        >
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-11" />
        </div>
      ))}
    </div>
  );
}

function FeatureFlagRow({ item }: { item: AdminFeatureFlagItem }) {
  const queryClient = useQueryClient();

  const { mutate: setEnabled, isPending: isSetting } = useMutation({
    mutationFn: (enabled: boolean) =>
      upsertFeatureFlag({ key: item.key, enabled, description: item.description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.featureFlags.all() });
    },
  });

  const { mutate: reset, isPending: isResetting } = useMutation({
    mutationFn: () => resetFeatureFlag(item.key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.featureFlags.all() });
    },
  });

  const isOverridden = item.override !== null;

  return (
    <TableRow className="hover:bg-muted/20">
      <TableCell>
        <p className="text-sm font-medium font-mono">{item.key}</p>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={isOverridden ? 'default' : 'secondary'} className="text-xs">
          {isOverridden ? 'Overridden' : 'Default'}
        </Badge>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {item.updatedAt ? formatDate(new Date(item.updatedAt)) : '—'}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Switch
            checked={item.effective}
            disabled={isSetting || isResetting}
            onCheckedChange={(checked) => setEnabled(checked)}
          />
          {isOverridden && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-foreground"
              disabled={isSetting || isResetting}
              onClick={() => reset()}
              title="Reset to coded default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function FeatureFlagsPage() {
  const {
    data: items,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.admin.featureFlags.all(),
    queryFn: getFeatureFlags,
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Feature Flags</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Toggle features without a deploy. A key with no override falls back to its coded default
          in <code className="text-xs">packages/config</code>.
        </p>
      </div>
      {isError ? (
        <p className="text-sm text-destructive py-4">
          Failed to load feature flags. Check that the API is reachable.
        </p>
      ) : isLoading ? (
        <TableSkeleton />
      ) : (
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-medium text-xs uppercase tracking-wide">Key</TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-wide">
                  Status
                </TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-wide">
                  Updated
                </TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-wide w-32">
                  Enabled
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(items ?? []).map((item) => (
                <FeatureFlagRow key={item.key} item={item} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
