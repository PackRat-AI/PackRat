'use client';

import { Input } from '@packrat/web-ui/components/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@packrat/web-ui/components/table';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  searchable?: boolean;
}

interface SearchableTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  getSearchText: (row: T) => string;
}

export function SearchableTable<T>({
  data,
  columns,
  searchPlaceholder = 'Search…',
  emptyMessage = 'No results.',
  getSearchText,
}: SearchableTableProps<T>) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter((row) => getSearchText(row).toLowerCase().includes(q));
  }, [data, query, getSearchText]);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              {columns.map((col) => (
                <TableHead key={col.key} className="font-medium text-xs uppercase tracking-wide">
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center text-muted-foreground py-8"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: no stable row id in generic table
                <TableRow key={i} className="hover:bg-muted/20">
                  {columns.map((col) => (
                    <TableCell key={col.key}>{col.render(row)}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length.toLocaleString()} of {data.length.toLocaleString()} results
          {query && ` matching "${query}"`}
        </p>
      )}
    </div>
  );
}
