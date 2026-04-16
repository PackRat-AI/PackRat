'use client';

import { Badge } from '@packrat/web-ui/components/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@packrat/web-ui/components/card';
import type { ChartConfig } from '@packrat/web-ui/components/chart';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@packrat/web-ui/components/chart';
import {
  useCatalogBrands,
  useCatalogEmbeddings,
  useCatalogEtl,
  useCatalogOverview,
  useCatalogPrices,
} from 'admin-app/hooks/use-catalog-analytics';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';

const priceConfig: ChartConfig = {
  count: { label: 'Items', color: 'hsl(var(--primary))' },
};

const brandConfig: ChartConfig = {
  itemCount: { label: 'Items', color: 'hsl(var(--primary))' },
};

const AVAIL_COLORS = [
  'hsl(160 60% 45%)',
  'hsl(var(--primary))',
  'hsl(38 92% 50%)',
  'hsl(0 72% 51%)',
  'hsl(280 65% 60%)',
  'hsl(211 100% 65%)',
];

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'completed') return 'default';
  if (status === 'failed') return 'destructive';
  return 'secondary';
}

export function CatalogAnalytics() {
  const { data: overview } = useCatalogOverview();
  const { data: brands } = useCatalogBrands(15);
  const { data: prices } = useCatalogPrices();
  const { data: etl } = useCatalogEtl(15);
  const { data: embeddings } = useCatalogEmbeddings();

  const availConfig: ChartConfig = Object.fromEntries(
    (overview?.availability ?? []).map((a, i) => [
      a.status ?? 'unknown',
      {
        label: a.status ?? 'Unknown',
        color: AVAIL_COLORS[i % AVAIL_COLORS.length] ?? 'hsl(var(--primary))',
      },
    ]),
  );

  return (
    <div className="grid gap-6">
      {/* Overview stat cards */}
      {overview && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Items', value: overview.totalItems.toLocaleString() },
            { label: 'Brands', value: overview.totalBrands.toLocaleString() },
            {
              label: 'Avg Price',
              value: overview.avgPrice != null ? `$${overview.avgPrice.toFixed(2)}` : '—',
            },
            { label: 'Added Last 30d', value: overview.addedLast30Days.toLocaleString() },
          ].map((s) => (
            <Card key={s.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Price distribution + Availability */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Price Distribution</CardTitle>
            <CardDescription>Catalog items across price buckets</CardDescription>
          </CardHeader>
          <CardContent>
            {prices && prices.length > 0 ? (
              <ChartContainer config={priceConfig} className="h-[260px] w-full">
                <BarChart
                  data={prices}
                  layout="vertical"
                  margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="bucket"
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Availability</CardTitle>
            <CardDescription>Items by stock status</CardDescription>
          </CardHeader>
          <CardContent>
            {overview?.availability && overview.availability.length > 0 ? (
              <ChartContainer config={availConfig} className="h-[260px] w-full">
                <PieChart>
                  <Pie
                    data={overview.availability.map((a) => ({
                      ...a,
                      status: a.status ?? 'Unknown',
                    }))}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {overview.availability.map((a, i) => (
                      <Cell
                        key={a.status ?? 'unknown'}
                        fill={AVAIL_COLORS[i % AVAIL_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent nameKey="status" />} />
                  <ChartLegend content={<ChartLegendContent nameKey="status" />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top brands */}
      <Card>
        <CardHeader>
          <CardTitle>Top Brands</CardTitle>
          <CardDescription>Brands by catalog item count</CardDescription>
        </CardHeader>
        <CardContent>
          {brands && brands.length > 0 ? (
            <ChartContainer config={brandConfig} className="h-[320px] w-full">
              <BarChart
                data={brands}
                layout="vertical"
                margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="brand"
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="itemCount" fill="var(--color-itemCount)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
              No data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Embedding coverage */}
      {embeddings && (
        <Card>
          <CardHeader>
            <CardTitle>Vector Embedding Coverage</CardTitle>
            <CardDescription>Semantic search embeddings across all catalog items</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-end gap-3">
              <span className="text-5xl font-bold">{embeddings.coveragePct}%</span>
              <span className="mb-1 text-sm text-muted-foreground">of items have embeddings</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${embeddings.coveragePct}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{embeddings.total.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Total Items</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {embeddings.withEmbedding.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Embedded</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-muted-foreground">
                  {embeddings.pending.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ETL pipeline */}
      {etl && (
        <Card>
          <CardHeader>
            <CardTitle>ETL Pipeline</CardTitle>
            <CardDescription>
              {etl.summary.totalRuns} total runs &mdash; {etl.summary.completed} completed,{' '}
              {etl.summary.failed} failed &mdash; {etl.summary.totalItemsIngested.toLocaleString()}{' '}
              items ingested
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Source</th>
                    <th className="pb-2 text-left font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Processed</th>
                    <th className="pb-2 text-right font-medium">Valid</th>
                    <th className="pb-2 text-right font-medium">Success %</th>
                    <th className="pb-2 text-left font-medium">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {etl.jobs.map((job) => (
                    <tr key={job.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs">{job.source}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={statusBadgeVariant(job.status)} className="text-xs">
                          {job.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {job.totalProcessed?.toLocaleString() ?? '—'}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {job.totalValid?.toLocaleString() ?? '—'}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {job.successRate != null ? `${job.successRate}%` : '—'}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(job.startedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
