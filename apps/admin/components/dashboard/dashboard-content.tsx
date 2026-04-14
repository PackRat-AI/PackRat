'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@packrat/web-ui/components/card';
import { useCatalogOverview } from 'admin-app/hooks/use-catalog-analytics';
import { usePlatformGrowth } from 'admin-app/hooks/use-platform-analytics';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from 'admin-app/components/ui/chart';
import type { ChartConfig } from 'admin-app/components/ui/chart';
import { Box, Database, TrendingUp, Users } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

const growthChartConfig: ChartConfig = {
  users: { label: 'Users', color: 'hsl(var(--primary))' },
  packs: { label: 'Packs', color: 'hsl(211 100% 65%)' },
  catalogItems: { label: 'Catalog Items', color: 'hsl(160 60% 45%)' },
};

export function DashboardContent() {
  const { data: overview } = useCatalogOverview();
  const { data: growth } = usePlatformGrowth('month');

  const recentUsers = growth?.reduce((sum, p) => sum + p.users, 0) ?? 0;
  const recentPacks = growth?.reduce((sum, p) => sum + p.packs, 0) ?? 0;

  const stats = [
    {
      title: 'Total Catalog Items',
      value: overview?.totalItems?.toLocaleString() ?? '—',
      description: `${overview?.addedLast30Days ?? 0} added last 30 days`,
      icon: Box,
    },
    {
      title: 'Brands in Catalog',
      value: overview?.totalBrands?.toLocaleString() ?? '—',
      description: 'Unique gear brands',
      icon: Database,
    },
    {
      title: 'New Users (12 mo)',
      value: recentUsers.toLocaleString(),
      description: 'Registered in the last year',
      icon: Users,
    },
    {
      title: 'New Packs (12 mo)',
      value: recentPacks.toLocaleString(),
      description: 'Packs created in the last year',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="grid gap-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Growth chart */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Growth</CardTitle>
          <CardDescription>Users and packs created over the last 12 months</CardDescription>
        </CardHeader>
        <CardContent>
          {growth && growth.length > 0 ? (
            <ChartContainer config={growthChartConfig} className="h-[300px] w-full">
              <AreaChart data={growth} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="period"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                  }}
                />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="var(--color-users)"
                  fill="var(--color-users)"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="packs"
                  stroke="var(--color-packs)"
                  fill="var(--color-packs)"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              No data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Availability + embedding quick stats */}
      {overview && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Availability Breakdown</CardTitle>
              <CardDescription>Catalog items by stock status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {overview.availability.slice(0, 6).map((a) => (
                  <div key={a.status ?? 'unknown'} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-muted-foreground">
                      {a.status ?? 'Unknown'}
                    </span>
                    <span className="font-medium">{a.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vector Embedding Coverage</CardTitle>
              <CardDescription>Items with semantic search embeddings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold">{overview.embeddingCoverage.pct}%</span>
                <span className="mb-1 text-sm text-muted-foreground">coverage</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${overview.embeddingCoverage.pct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{overview.embeddingCoverage.withEmbedding.toLocaleString()} embedded</span>
                <span>{(overview.embeddingCoverage.total - overview.embeddingCoverage.withEmbedding).toLocaleString()} pending</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
