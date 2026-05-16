'use client';

import { Badge } from '@packrat/web-ui/components/badge';
import { Button } from '@packrat/web-ui/components/button';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@packrat/web-ui/components/dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RawObjectDialog } from 'admin-app/components/raw-object-dialog';
import {
  useCatalogBrands,
  useCatalogEmbeddings,
  useCatalogEtl,
  useCatalogOverview,
  useCatalogPrices,
  useEtlFailureSummary,
  useEtlJobFailures,
} from 'admin-app/hooks/use-catalog-analytics';
import { resetStuckEtlJobs, retryEtlJob } from 'admin-app/lib/api';
import { queryKeys } from 'admin-app/lib/queryKeys';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
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

function EtlJobFailuresDialog({ jobId, totalInvalid }: { jobId: string; totalInvalid: number }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useEtlJobFailures(jobId, { enabled: open });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          {totalInvalid.toLocaleString()} failures
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">Failures — job {jobId}</DialogTitle>
          <DialogDescription className="sr-only">
            Validation failures for ETL job {jobId}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : data ? (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {data.errorBreakdown.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Error breakdown</h4>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="pb-1 text-left font-medium">Field</th>
                      <th className="pb-1 text-left font-medium">Reason</th>
                      <th className="pb-1 text-right font-medium">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.errorBreakdown.map((e) => (
                      <tr key={`${e.field}|${e.reason}`} className="border-b last:border-0">
                        <td className="py-1 pr-4 font-mono">{e.field}</td>
                        <td className="py-1 pr-4 text-muted-foreground">{e.reason}</td>
                        <td className="py-1 text-right font-medium">{e.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.samples.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Sample rows{' '}
                  <span className="text-muted-foreground font-normal">
                    (showing {data.samples.length} of {data.totalShown} fetched)
                  </span>
                </h4>
                <div className="space-y-2">
                  {data.samples.map((s) => (
                    <div
                      key={s.rowIndex}
                      className="rounded-md border bg-muted/50 p-3 text-xs space-y-1"
                    >
                      <div className="text-muted-foreground">Row {s.rowIndex}</div>
                      <div className="flex flex-wrap gap-1">
                        {s.errors.map((e, i) => (
                          <Badge
                            key={i}
                            variant="destructive"
                            className="text-xs font-mono font-normal"
                          >
                            {e.field}: {e.reason}
                          </Badge>
                        ))}
                      </div>
                      {s.rawData != null && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            raw data
                          </summary>
                          <pre className="mt-1 text-xs whitespace-pre-wrap break-all">
                            {JSON.stringify(s.rawData, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const ETL_PAGE_SIZE = 25;

export function CatalogAnalytics() {
  const queryClient = useQueryClient();
  const [etlLimit, setEtlLimit] = useState(ETL_PAGE_SIZE);

  const { data: overview } = useCatalogOverview();
  const { data: brands } = useCatalogBrands(15);
  const { data: prices } = useCatalogPrices();
  const { data: etl, isFetching: etlFetching } = useCatalogEtl(etlLimit);
  const { data: embeddings } = useCatalogEmbeddings();
  const { data: failureSummary } = useEtlFailureSummary(20);

  const {
    mutate: resetStuck,
    isPending: isResetting,
    isError: resetFailed,
    data: resetResult,
  } = useMutation({
    mutationFn: resetStuckEtlJobs,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.catalogAnalytics.etl.all() });
    },
  });

  const {
    mutate: retryJob,
    isPending: isRetrying,
    variables: retryingJobId,
  } = useMutation({
    mutationFn: retryEtlJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.catalogAnalytics.etl.all() });
    },
  });

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
              label: 'Price Range',
              value:
                overview.minPrice != null && overview.maxPrice != null
                  ? `$${overview.minPrice.toFixed(2)}–$${overview.maxPrice.toFixed(2)}`
                  : overview.avgPrice != null
                    ? `avg $${overview.avgPrice.toFixed(2)}`
                    : '—',
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

      {/* ETL failure summary */}
      {failureSummary && failureSummary.topErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Validation Errors</CardTitle>
            <CardDescription>
              Most common failure patterns across all ETL jobs —{' '}
              {failureSummary.totalInvalidItems.toLocaleString()} invalid items sampled
            </CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-2 text-left font-medium">Field</th>
                  <th className="pb-2 text-left font-medium">Reason</th>
                  <th className="pb-2 text-right font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {failureSummary.topErrors.map((e) => (
                  <tr key={`${e.field}|${e.reason}`} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{e.field}</td>
                    <td className="py-2 pr-4 text-muted-foreground text-xs">{e.reason}</td>
                    <td className="py-2 text-right font-medium">{e.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ETL pipeline */}
      {etl && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>ETL Pipeline</CardTitle>
                <CardDescription>
                  {etl.summary.totalRuns} total runs &mdash; {etl.summary.completed} completed,{' '}
                  {etl.summary.failed} failed &mdash;{' '}
                  {etl.summary.totalItemsIngested.toLocaleString()} items ingested
                  {resetFailed && <span className="ml-2 text-destructive">— reset failed</span>}
                  {!resetFailed && resetResult && resetResult.reset > 0 && (
                    <span className="ml-2 text-green-600 dark:text-green-400">
                      — reset {resetResult.reset} stuck job{resetResult.reset !== 1 ? 's' : ''}
                    </span>
                  )}
                  {!resetFailed && resetResult && resetResult.reset === 0 && (
                    <span className="ml-2 text-muted-foreground">— no stuck jobs found</span>
                  )}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resetStuck()}
                disabled={isResetting}
                className="shrink-0"
              >
                <RotateCcw className={`h-3.5 w-3.5 mr-1.5 ${isResetting ? 'animate-spin' : ''}`} />
                Reset Stuck
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 text-left font-medium">Source / File</th>
                    <th className="pb-2 text-left font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Processed</th>
                    <th className="pb-2 text-right font-medium">Valid</th>
                    <th className="pb-2 text-right font-medium">Invalid</th>
                    <th className="pb-2 text-left font-medium">Failures</th>
                    <th className="pb-2 text-right font-medium">Success %</th>
                    <th className="pb-2 text-left font-medium">Started</th>
                    <th className="pb-2 text-left font-medium">Completed</th>
                    <th className="pb-2 w-8" />
                    <th className="pb-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {etl.jobs.map((job) => (
                    <tr key={job.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <div className="font-mono text-xs">{job.source}</div>
                        {job.filename && (
                          <div
                            className="text-xs text-muted-foreground truncate max-w-[180px]"
                            title={job.filename}
                          >
                            {job.filename}
                          </div>
                        )}
                        {job.scraperRevision && (
                          <div className="text-[10px] text-muted-foreground/60 font-mono">
                            rev {job.scraperRevision.slice(0, 7)}
                          </div>
                        )}
                      </td>
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
                        {job.totalInvalid != null ? (
                          <span className={job.totalInvalid > 0 ? 'text-destructive' : ''}>
                            {job.totalInvalid.toLocaleString()}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {job.totalInvalid != null && job.totalInvalid > 0 ? (
                          <EtlJobFailuresDialog jobId={job.id} totalInvalid={job.totalInvalid} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {job.successRate != null ? `${job.successRate}%` : '—'}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {new Date(job.startedAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {job.completedAt ? new Date(job.completedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-2">
                        <RawObjectDialog label={`job:${job.id}`} data={job} />
                      </td>
                      <td className="py-2">
                        {job.status === 'failed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            disabled={isRetrying && retryingJobId === job.id}
                            onClick={() => retryJob(job.id)}
                          >
                            <RotateCcw
                              className={`h-3 w-3 mr-1 ${isRetrying && retryingJobId === job.id ? 'animate-spin' : ''}`}
                            />
                            Retry
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {etl.jobs.length >= etlLimit && etlLimit < 200 && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEtlLimit((prev) => Math.min(prev + ETL_PAGE_SIZE, 200))}
                  disabled={etlFetching}
                >
                  {etlFetching ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
            {etl.jobs.length === 200 && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Showing maximum 200 jobs. Use the API directly for full history.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
