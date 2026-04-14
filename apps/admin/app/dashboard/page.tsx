import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@packrat/web-ui/components/card';
import { Skeleton } from '@packrat/web-ui/components/skeleton';
import { getCatalogItems, getPacks, getStats, getUsers } from 'admin-app/lib/api';
import { StatsCards } from 'admin-app/components/stats-cards';
import { formatDistanceToNow } from 'admin-app/lib/date';
import { Backpack, Package, Users } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Overview' };

// ── Overview cards ────────────────────────────────────────────────────────────

async function OverviewContent() {
  const [stats, users, packs, catalog] = await Promise.all([
    getStats(),
    getUsers(5),
    getPacks(5),
    getCatalogItems(5),
  ]);

  return (
    <>
      <StatsCards stats={stats} />

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {/* Recent Users */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Users className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Recent Users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {u.createdAt ? formatDistanceToNow(new Date(u.createdAt)) : '—'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Packs */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Backpack className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Recent Packs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {packs.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.userEmail ?? 'Unknown user'}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {p.createdAt ? formatDistanceToNow(new Date(p.createdAt)) : '—'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Catalog */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Package className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Recent Catalog Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {catalog.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.brand ?? 'Unknown brand'}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {item.weight ? `${item.weight}${item.weightUnit}` : '—'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function OverviewSkeleton() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeletons have no identity
          <Card key={i} className="border-border/60">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeletons have no identity
          <Card key={i} className="border-border/60">
            <CardHeader className="pb-3">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((_, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeletons have no identity
                <div key={j} className="flex justify-between gap-2">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-0">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Your PackRat platform at a glance.
        </p>
      </div>
      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewContent />
      </Suspense>
    </div>
  );
}
