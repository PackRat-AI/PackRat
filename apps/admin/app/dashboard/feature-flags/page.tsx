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
  type ClientPlatform,
  getFeatureFlags,
  resetFeatureFlag,
  setFeatureFlagPlatformOverride,
  upsertFeatureFlag,
} from 'admin-app/lib/api';
import { formatDate } from 'admin-app/lib/date';
import { queryKeys } from 'admin-app/lib/queryKeys';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { useState } from 'react';

/**
 * The platforms a flag can be targeted at, in display order.
 *
 * Web is deliberately absent: it reads flags but resolves them globally, so
 * offering a web toggle would imply targeting that does not exist.
 */
const TARGETABLE_PLATFORMS: readonly { platform: ClientPlatform; label: string }[] = [
  { platform: 'ios', label: 'iOS' },
  { platform: 'android', label: 'Android' },
  { platform: 'macos', label: 'macOS' },
];

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

/**
 * One platform's state for a flag: either inheriting the flag's global value,
 * or explicitly overriding it.
 *
 * The switch always shows what that platform actually resolves to, so the row
 * reads as the answer to "is this on here?" rather than "is there a row in the
 * database?". The badge is what distinguishes an inherited value from a
 * deliberate one.
 */
function PlatformOverrideRow({
  item,
  platform,
  label,
}: {
  item: AdminFeatureFlagItem;
  platform: ClientPlatform;
  label: string;
}) {
  const queryClient = useQueryClient();
  const override = item.platformOverrides[platform];
  const isOverridden = override !== undefined;
  const effective = isOverridden ? override.enabled : item.effective;

  const { mutate: setOverride, isPending } = useMutation({
    mutationFn: (enabled: boolean | null) =>
      setFeatureFlagPlatformOverride({ key: item.key, platform, enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.featureFlags.all() });
    },
  });

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs font-medium w-16 text-muted-foreground">{label}</span>

      <Switch
        checked={effective}
        disabled={isPending}
        onCheckedChange={(checked) => setOverride(checked)}
        aria-label={`${label}: ${item.key}`}
      />

      {isOverridden ? (
        <>
          <Badge variant="default" className="text-[10px] px-1.5 py-0">
            Override
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            disabled={isPending}
            // null clears the override; the platform goes back to following
            // the flag's global value.
            onClick={() => setOverride(null)}
            title={`Clear the ${label} override and inherit the global value`}
          >
            Inherit
          </Button>
        </>
      ) : (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
          Inherited
        </Badge>
      )}
    </div>
  );
}

function FeatureFlagRow({ item }: { item: AdminFeatureFlagItem }) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);

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
  const platformOverrideCount = Object.keys(item.platformOverrides).length;

  return (
    <>
      <TableRow className="hover:bg-muted/20">
        <TableCell>
          <div className="flex items-start gap-1.5">
            <button
              type="button"
              onClick={() => setIsExpanded((open) => !open)}
              className="mt-0.5 text-muted-foreground hover:text-foreground shrink-0"
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? 'Hide' : 'Show'} platform targeting for ${item.key}`}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
            <div>
              <p className="text-sm font-medium font-mono">{item.key}</p>
              {item.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              )}
              {platformOverrideCount > 0 && !isExpanded && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {platformOverrideCount === 1
                    ? '1 platform override'
                    : `${platformOverrideCount} platform overrides`}
                </p>
              )}
            </div>
          </div>
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

      {isExpanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={4} className="bg-muted/20 py-3">
            <div className="pl-6">
              <p className="text-xs text-muted-foreground mb-2">
                Per-platform targeting. A platform without an override follows the flag's value
                above.
              </p>
              {TARGETABLE_PLATFORMS.map(({ platform, label }) => (
                <PlatformOverrideRow key={platform} item={item} platform={platform} label={label} />
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
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
