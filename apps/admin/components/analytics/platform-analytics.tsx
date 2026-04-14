'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@packrat/web-ui/components/card';
import { Tabs, TabsList, TabsTrigger } from '@packrat/web-ui/components/tabs';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from 'admin-app/components/ui/chart';
import type { ChartConfig } from 'admin-app/components/ui/chart';
import { usePlatformActivity, usePlatformBreakdown, usePlatformGrowth } from 'admin-app/hooks/use-platform-analytics';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';

const growthConfig: ChartConfig = {
  users: { label: 'Users', color: 'hsl(var(--primary))' },
  packs: { label: 'Packs', color: 'hsl(211 100% 65%)' },
  catalogItems: { label: 'Catalog Items', color: 'hsl(160 60% 45%)' },
};

const activityConfig: ChartConfig = {
  trips: { label: 'Trips', color: 'hsl(var(--primary))' },
  trailReports: { label: 'Trail Reports', color: 'hsl(38 92% 50%)' },
  posts: { label: 'Posts', color: 'hsl(280 65% 60%)' },
};

const BREAKDOWN_COLORS = [
  'hsl(var(--primary))',
  'hsl(211 100% 65%)',
  'hsl(160 60% 45%)',
  'hsl(38 92% 50%)',
  'hsl(280 65% 60%)',
  'hsl(0 72% 51%)',
];

type Period = 'day' | 'week' | 'month';

function formatPeriodLabel(v: string, period: Period) {
  const d = new Date(v);
  if (period === 'day') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (period === 'week') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export function PlatformAnalytics() {
  const [period, setPeriod] = useState<Period>('month');

  const { data: growth, isLoading: growthLoading } = usePlatformGrowth(period);
  const { data: activity, isLoading: activityLoading } = usePlatformActivity(period);
  const { data: breakdown } = usePlatformBreakdown();

  const breakdownConfig: ChartConfig = Object.fromEntries(
    (breakdown ?? []).map((b, i) => [
      b.category,
      { label: b.category, color: BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length] ?? 'hsl(var(--primary))' },
    ]),
  );

  return (
    <div className="grid gap-6">
      {/* Period selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Period:</span>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="day">Daily</TabsTrigger>
            <TabsTrigger value="week">Weekly</TabsTrigger>
            <TabsTrigger value="month">Monthly</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Growth chart */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Growth</CardTitle>
          <CardDescription>New users, packs, and catalog additions over time</CardDescription>
        </CardHeader>
        <CardContent>
          {growthLoading ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : growth && growth.length > 0 ? (
            <ChartContainer config={growthConfig} className="h-[300px] w-full">
              <LineChart data={growth} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="period"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => formatPeriodLabel(v, period)}
                />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line type="monotone" dataKey="users" stroke="var(--color-users)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="packs" stroke="var(--color-packs)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="catalogItems" stroke="var(--color-catalogItems)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              No data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity chart */}
      <Card>
        <CardHeader>
          <CardTitle>User Activity</CardTitle>
          <CardDescription>Trips planned, trail reports, and posts over time</CardDescription>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : activity && activity.length > 0 ? (
            <ChartContainer config={activityConfig} className="h-[300px] w-full">
              <BarChart data={activity} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="period"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => formatPeriodLabel(v, period)}
                />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="trips" fill="var(--color-trips)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="trailReports" fill="var(--color-trailReports)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="posts" fill="var(--color-posts)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              No data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pack category breakdown */}
      {breakdown && breakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pack Categories</CardTitle>
            <CardDescription>Distribution of packs by category</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ChartContainer config={breakdownConfig} className="h-[300px] w-full max-w-md">
              <PieChart>
                <Pie
                  data={breakdown}
                  dataKey="count"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={2}
                >
                  {breakdown.map((entry, index) => (
                    <Cell
                      key={entry.category}
                      fill={BREAKDOWN_COLORS[index % BREAKDOWN_COLORS.length]}
                    />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent nameKey="category" />} />
                <ChartLegend content={<ChartLegendContent nameKey="category" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
