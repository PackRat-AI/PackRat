'use client';
import { usePacks } from '@packrat/app';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Skeleton } from 'web-app/components/ui/skeleton';
import { cn } from 'web-app/lib/utils';
import { useWeight } from 'web-app/lib/weight-context';

export function GearInventoryScreen({ onBack: _onBack }: { onBack?: () => void }) {
  const { fw } = useWeight();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const { data: packsRaw, isLoading } = usePacks();

  const allItems = useMemo(() => {
    if (!packsRaw) return [];
    const seen = new Set<string>();
    const items: NonNullable<(typeof packsRaw)[number]['items']>[number][] = [];
    for (const pack of packsRaw) {
      for (const item of pack.items ?? []) {
        if (!seen.has(item.id) && !item.deleted) {
          seen.add(item.id);
          items.push(item);
        }
      }
    }
    return items;
  }, [packsRaw]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const item of allItems) {
      if (item.category) cats.add(item.category);
    }
    return ['All', ...Array.from(cats).sort()];
  }, [allItems]);

  const filtered = useMemo(
    () =>
      allItems.filter((item) => {
        const matchCat = selectedCategory === 'All' || item.category === selectedCategory;
        const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
        return matchCat && matchSearch;
      }),
    [allItems, search, selectedCategory],
  );

  const totalWeight = useMemo(
    () => filtered.reduce((sum, item) => sum + item.weight * item.quantity, 0),
    [filtered],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-3 md:px-6 md:pt-6 border-b border-border sticky top-0 z-10 bg-background">
        <h1 className="text-2xl font-bold tracking-tight mb-3">Gear Inventory</h1>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search gear…"
            className="w-full rounded-xl bg-muted pl-9 pr-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors',
                selectedCategory === cat
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 space-y-2 pb-24">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="font-semibold text-muted-foreground">No items found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add items to your packs to see them here
            </p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl bg-card border border-border p-4 flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{item.name}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  {item.category && (
                    <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
                      {item.category}
                    </span>
                  )}
                  {item.quantity > 1 && (
                    <span className="text-[11px] text-muted-foreground">×{item.quantity}</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-semibold text-primary">
                  {fw(item.weight * item.quantity)}
                </p>
                <p className="text-[10px] text-muted-foreground">{fw(item.weight)} each</p>
              </div>
            </div>
          ))
        )}
      </div>

      {!isLoading && filtered.length > 0 && (
        <div className="fixed bottom-20 md:bottom-0 right-4 md:right-6 pb-4">
          <div className="rounded-2xl bg-card border border-border px-4 py-2.5 text-right">
            <p className="text-[10px] text-muted-foreground">Total Weight</p>
            <p className="text-sm font-bold text-primary">{fw(totalWeight)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
