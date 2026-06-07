'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@packrat/web-ui/components/card';
import { Tabs, TabsList, TabsTrigger } from '@packrat/web-ui/components/tabs';
import {
  useQueryMetricsByCallSite,
  useQueryMetricsRecent,
  useQueryMetricsSummary,
} from 'admin-app/hooks/use-query-metrics';
import { useState } from 'react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

type RollingHours = 1 | 6 | 24 | 168;
const ROLLING_OPTIONS: { label: string; value: RollingHours }[] = [
  { label: '1h', value: 1 },
  { label: '6h', value: 6 },
  { label: '24h', value: 24 },
  { label: '7d', value: 168 },
];

type Period = { mode: 'rolling'; hours: RollingHours } | { mode: 'month'; month: string };

function toYyyyMm(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-');
  return new Date(Number(year), Number(month) - 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });
}

function shiftMonth(yyyyMm: string, delta: number): string {
  const parts = yyyyMm.split('-').map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const d = new Date(y, m - 1 + delta, 1);
  return toYyyyMm(d);
}

export function QueryMetricsAnalytics() {
  const [period, setPeriod] = useState<Period>({ mode: 'rolling', hours: 24 });

  const month = period.mode === 'month' ? period.month : undefined;
  const hours = period.mode === 'rolling' ? period.hours : 24;

  const { data: callSiteData, isLoading: callSiteLoading } = useQueryMetricsByCallSite({
    hours,
    month,
  });
  const { data: summary, isLoading: summaryLoading } = useQueryMetricsSummary({ hours, month });
  const { data: recent, isLoading: recentLoading } = useQueryMetricsRecent(50);

  const currentMonth = toYyyyMm(new Date());
  const isCurrentMonth = period.mode === 'month' && period.month === currentMonth;

  return (
    <div className="grid gap-6">
      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={period.mode === 'rolling' ? String(period.hours) : ''}
          onValueChange={(v) => setPeriod({ mode: 'rolling', hours: Number(v) as RollingHours })}
        >
          <TabsList>
            {ROLLING_OPTIONS.map((o) => (
              <TabsTrigger key={o.value} value={String(o.value)}>
                {o.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <span className="text-muted-foreground text-sm">or</span>

        {/* Month navigator */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              setPeriod((p) => ({
                mode: 'month',
                month: shiftMonth(p.mode === 'month' ? p.month : currentMonth, -1),
              }))
            }
            className="rounded px-2 py-1 text-sm hover:bg-muted"
            aria-label="Previous month"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() =>
              setPeriod((p) => ({
                mode: 'month',
                month: p.mode === 'month' ? p.month : currentMonth,
              }))
            }
            className={`rounded px-3 py-1 text-sm font-medium ${period.mode === 'month' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
          >
            {period.mode === 'month' ? formatMonth(period.month) : 'Month'}
          </button>
          <button
            type="button"
            onClick={() =>
              setPeriod((p) => ({
                mode: 'month',
                month: shiftMonth(p.mode === 'month' ? p.month : currentMonth, 1),
              }))
            }
            disabled={isCurrentMonth}
            className="rounded px-2 py-1 text-sm hover:bg-muted disabled:opacity-30"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Requests</CardDescription>
            <CardTitle className="text-2xl">
              {summaryLoading ? '—' : (summary?.summary.totalRequests.toLocaleString() ?? '—')}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total DB Compute</CardDescription>
            <CardTitle className="text-2xl">
              {callSiteLoading
                ? '—'
                : formatMs(
                    callSiteData?.callSites.reduce((acc, r) => acc + r.totalDurationMs, 0) ?? 0,
                  )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total DB Egress</CardDescription>
            <CardTitle className="text-2xl">
              {callSiteLoading
                ? '—'
                : formatBytes(
                    callSiteData?.callSites.reduce((acc, r) => acc + r.totalResultBytes, 0) ?? 0,
                  )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Top call sites by compute — primary view */}
      <Card>
        <CardHeader>
          <CardTitle>Top Queries by Compute</CardTitle>
          <CardDescription>
            Per-query DB time grouped by call site — exact timing measured at the driver level
          </CardDescription>
        </CardHeader>
        <CardContent>
          {callSiteLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Call Site</th>
                    <th className="pb-2 text-right font-medium">Calls</th>
                    <th className="pb-2 text-right font-medium">Total Time</th>
                    <th className="pb-2 text-right font-medium">Avg Time</th>
                    <th className="pb-2 text-right font-medium">Total Egress</th>
                    <th className="pb-2 text-right font-medium">Routes</th>
                  </tr>
                </thead>
                <tbody>
                  {(callSiteData?.callSites ?? []).map((row) => (
                    <tr key={row.callSite} className="border-b last:border-0">
                      <td className="py-2 max-w-[340px]">
                        <span className="block truncate font-mono text-xs" title={row.callSite}>
                          {row.callSite}
                        </span>
                        <span
                          className="block truncate text-xs text-muted-foreground"
                          title={row.samplePreview}
                        >
                          {row.samplePreview}
                        </span>
                      </td>
                      <td className="py-2 text-right">{row.queryCount.toLocaleString()}</td>
                      <td className="py-2 text-right">{formatMs(row.totalDurationMs)}</td>
                      <td className="py-2 text-right">{formatMs(row.avgDurationMs)}</td>
                      <td className="py-2 text-right">{formatBytes(row.totalResultBytes)}</td>
                      <td className="py-2 text-right text-muted-foreground">
                        {row.distinctRoutes}
                      </td>
                    </tr>
                  ))}
                  {(callSiteData?.callSites ?? []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-muted-foreground">
                        No call-site data yet — queries need a callSite frame to appear here
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top routes by compute — secondary context */}
      <Card>
        <CardHeader>
          <CardTitle>Top Routes by Compute</CardTitle>
          <CardDescription>Request-level wall time per endpoint</CardDescription>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Route</th>
                    <th className="pb-2 font-medium">Method</th>
                    <th className="pb-2 text-right font-medium">Calls</th>
                    <th className="pb-2 text-right font-medium">Total</th>
                    <th className="pb-2 text-right font-medium">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary?.topByCompute ?? []).map((row) => (
                    <tr key={`${row.method}:${row.route}`} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">{row.route}</td>
                      <td className="py-2 text-muted-foreground">{row.method}</td>
                      <td className="py-2 text-right">{row.callCount.toLocaleString()}</td>
                      <td className="py-2 text-right">{formatMs(row.totalDurationMs)}</td>
                      <td className="py-2 text-right">{formatMs(row.avgDurationMs)}</td>
                    </tr>
                  ))}
                  {(summary?.topByCompute ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-muted-foreground">
                        No data for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent requests */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Requests</CardTitle>
          <CardDescription>Last 50 captured API requests with query counts</CardDescription>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Time</th>
                    <th className="pb-2 font-medium">Route</th>
                    <th className="pb-2 font-medium">Method</th>
                    <th className="pb-2 text-right font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Duration</th>
                    <th className="pb-2 text-right font-medium">Egress</th>
                    <th className="pb-2 text-right font-medium">Queries</th>
                  </tr>
                </thead>
                <tbody>
                  {(recent?.requests ?? []).map((req) => (
                    <tr key={req.id} className="border-b last:border-0">
                      <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(req.capturedAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2 font-mono text-xs max-w-[200px] truncate">{req.route}</td>
                      <td className="py-2 text-muted-foreground">{req.method}</td>
                      <td className="py-2 text-right">
                        <span
                          className={
                            (req.statusCode ?? 200) >= 500
                              ? 'text-destructive'
                              : (req.statusCode ?? 200) >= 400
                                ? 'text-yellow-600'
                                : 'text-green-600'
                          }
                        >
                          {req.statusCode ?? '—'}
                        </span>
                      </td>
                      <td className="py-2 text-right">{formatMs(req.totalDurationMs)}</td>
                      <td className="py-2 text-right">{formatBytes(req.estimatedEgressBytes)}</td>
                      <td className="py-2 text-right">{req.queryCount}</td>
                    </tr>
                  ))}
                  {(recent?.requests ?? []).length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-muted-foreground">
                        No requests captured yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
