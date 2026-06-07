'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@packrat/web-ui/components/card';
import { Tabs, TabsList, TabsTrigger } from '@packrat/web-ui/components/tabs';
import { useQueryMetricsRecent, useQueryMetricsSummary } from 'admin-app/hooks/use-query-metrics';
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

type Hours = 1 | 6 | 24 | 168;
const HOUR_OPTIONS: { label: string; value: Hours }[] = [
  { label: '1h', value: 1 },
  { label: '6h', value: 6 },
  { label: '24h', value: 24 },
  { label: '7d', value: 168 },
];

export function QueryMetricsAnalytics() {
  const [hours, setHours] = useState<Hours>(24);
  const { data: summary, isLoading: summaryLoading } = useQueryMetricsSummary(hours);
  const { data: recent, isLoading: recentLoading } = useQueryMetricsRecent(50);

  return (
    <div className="grid gap-6">
      {/* Period selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Period:</span>
        <Tabs value={String(hours)} onValueChange={(v) => setHours(Number(v) as Hours)}>
          <TabsList>
            {HOUR_OPTIONS.map((o) => (
              <TabsTrigger key={o.value} value={String(o.value)}>
                {o.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
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
            <CardDescription>Total Compute</CardDescription>
            <CardTitle className="text-2xl">
              {summaryLoading ? '—' : formatMs(summary?.summary.totalDurationMs ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Egress (est.)</CardDescription>
            <CardTitle className="text-2xl">
              {summaryLoading ? '—' : formatBytes(summary?.summary.totalEgressBytes ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Top routes by compute */}
      <Card>
        <CardHeader>
          <CardTitle>Top Routes by Compute</CardTitle>
          <CardDescription>Total time spent in Postgres queries per endpoint</CardDescription>
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

      {/* Top routes by egress */}
      <Card>
        <CardHeader>
          <CardTitle>Top Routes by Egress</CardTitle>
          <CardDescription>
            Estimated bytes returned per endpoint (from content-length)
          </CardDescription>
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
                  {(summary?.topByEgress ?? []).map((row) => (
                    <tr key={`${row.method}:${row.route}`} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">{row.route}</td>
                      <td className="py-2 text-muted-foreground">{row.method}</td>
                      <td className="py-2 text-right">{row.callCount.toLocaleString()}</td>
                      <td className="py-2 text-right">{formatBytes(row.totalEgressBytes)}</td>
                      <td className="py-2 text-right">{formatBytes(row.avgEgressBytes)}</td>
                    </tr>
                  ))}
                  {(summary?.topByEgress ?? []).length === 0 && (
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
