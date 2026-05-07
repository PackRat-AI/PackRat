'use client';
import { useCatalogItemsInfinite, weightClass } from '@packrat/app';
import { BookmarkPlus, CheckCircle, Plus, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import React, { useState } from 'react';
import { Skeleton } from 'web-app/components/ui/skeleton';
import type { CatalogItem } from 'web-app/lib/types';
import { cn } from 'web-app/lib/utils';
import { useWeight } from 'web-app/lib/weight-context';

const CATEGORIES = [
  'shelter',
  'sleep',
  'packs',
  'kitchen',
  'water',
  'clothing',
  'electronics',
  'navigation',
];

const WEIGHT_CLASSES = [
  { label: 'All', value: 'all' },
  { label: 'Ultralight <100g', value: 'ultralight' },
  { label: 'Lightweight', value: 'lightweight' },
  { label: 'Standard', value: 'standard' },
];

export function CatalogScreen() {
  const { fw } = useWeight();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedWeightClass, setSelectedWeightClass] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [addedItems, setAddedItems] = useState<Set<number>>(new Set());
  const [savedItems, setSavedItems] = useState<Set<number>>(new Set());
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);

  // TanStack Query (infinite scroll)
  const {
    data: catalogData,
    isLoading,
    hasNextPage,
    fetchNextPage,
  } = useCatalogItemsInfinite({
    query: search || undefined,
    category: selectedCategory || undefined,
    limit: 20,
  });

  const allItems = React.useMemo(
    () => catalogData?.pages.flatMap((p) => p.items) ?? [],
    [catalogData],
  );

  // Client-side weight class filtering (since the API doesn't support it)
  const filteredItems = React.useMemo(() => {
    if (selectedWeightClass === 'all') return allItems;
    return allItems.filter((item) => weightClass(item.weight) === selectedWeightClass);
  }, [allItems, selectedWeightClass]);

  const activeFilterCount = (selectedCategory ? 1 : 0) + (selectedWeightClass !== 'all' ? 1 : 0);

  return (
    <div className="flex flex-col h-full">
      {/* Search + Filter header */}
      <div className="px-4 pt-5 pb-3 md:px-6 md:pt-6 space-y-3 border-b border-border bg-background sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Catalog</h1>
          <span className="text-sm text-muted-foreground">
            {isLoading ? '...' : `${filteredItems.length} items`}
          </span>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id="catalog-search"
              name="catalog-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search gear, brand..."
              className="w-full rounded-xl bg-muted pl-9 pr-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
              showFilters || activeFilterCount > 0
                ? 'bg-primary/20 text-primary'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="text-xs rounded-full bg-primary text-white px-1.5 py-0.5 leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="space-y-3 pt-1">
            {/* Weight class */}
            <div className="flex flex-wrap gap-1.5">
              {WEIGHT_CLASSES.map((wc) => (
                <button
                  type="button"
                  key={wc.value}
                  onClick={() => setSelectedWeightClass(wc.value)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                    selectedWeightClass === wc.value
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground hover:text-foreground',
                  )}
                >
                  {wc.label}
                </button>
              ))}
            </div>
            {/* Categories */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-semibold transition-colors capitalize',
                    selectedCategory === cat
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground hover:text-foreground',
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory(null);
                  setSelectedWeightClass('all');
                }}
                className="text-xs text-destructive font-semibold"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-20">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-card border border-border p-4 space-y-3">
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-10" />
                </div>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full" />
                <div className="flex justify-between">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-12" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-semibold">No items found</p>
            <p className="text-sm text-muted-foreground mt-1">Try a different search or filter</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-20">
              {filteredItems.map((item) => (
                <CatalogCard
                  key={item.id}
                  item={item}
                  fw={fw}
                  isAdded={addedItems.has(item.id)}
                  isSaved={savedItems.has(item.id)}
                  onSelect={() => setSelectedItem(item)}
                  onAdd={() => setAddedItems((s) => new Set([...s, item.id]))}
                  onSave={() =>
                    setSavedItems((s) => {
                      const n = new Set(s);
                      n.has(item.id) ? n.delete(item.id) : n.add(item.id);
                      return n;
                    })
                  }
                />
              ))}
            </div>
            {hasNextPage && (
              <div className="flex justify-center pb-20 pt-4">
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  className="rounded-xl bg-muted px-6 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Gear Detail Modal */}
      {selectedItem && (
        <GearDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          fw={fw}
          isAdded={addedItems.has(selectedItem.id)}
          isSaved={savedItems.has(selectedItem.id)}
          onAdd={() => setAddedItems((s) => new Set([...s, selectedItem.id]))}
          onSave={() =>
            setSavedItems((s) => {
              const n = new Set(s);
              n.has(selectedItem.id) ? n.delete(selectedItem.id) : n.add(selectedItem.id);
              return n;
            })
          }
        />
      )}
    </div>
  );
}

function CatalogCard({
  item,
  fw,
  isAdded,
  isSaved,
  onSelect,
  onAdd,
  onSave,
}: {
  item: CatalogItem;
  fw: (g: number) => string;
  isAdded: boolean;
  isSaved: boolean;
  onSelect: () => void;
  onAdd: () => void;
  onSave: () => void;
}) {
  const wc = weightClass(item.weight);
  const wcStyles = {
    ultralight: 'bg-[#30d158]/15 text-[#30d158]',
    lightweight: 'bg-[#ff9f0a]/15 text-[#ff9f0a]',
    standard: 'bg-muted text-muted-foreground',
  };
  const wcLabels = { ultralight: 'UL', lightweight: 'LW', standard: 'STD' };

  return (
    // biome-ignore lint/a11y/useSemanticElements: div needed to avoid nested <button> (card contains action buttons)
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-3 text-left hover:border-primary/30 transition-colors cursor-pointer"
    >
      {/* Badge + Weight Class */}
      <div className="flex items-start justify-between">
        {item.categories?.[0] && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground capitalize">
            {item.categories[0]}
          </span>
        )}
        <span
          className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', wcStyles[wc])}
        >
          {wcLabels[wc]}
        </span>
      </div>

      {/* Name / Brand */}
      <div>
        <p className="font-semibold text-sm leading-tight">{item.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{item.seller}</p>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed flex-1 line-clamp-2">
        {item.description}
      </p>

      {/* Weight + Rating + Price */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold">{fw(item.weight)}</span>
          {item.ratingValue && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-[#ff9f0a] text-[#ff9f0a]" />
              {item.ratingValue.toFixed(1)}
            </span>
          )}
        </div>
        {item.price && <span className="text-xs text-muted-foreground">${item.price}</span>}
      </div>

      {/* Actions */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stop propagation wrapper, children are interactive */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stop propagation wrapper */}
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onAdd}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition-colors',
            isAdded
              ? 'bg-[#30d158]/15 text-[#30d158]'
              : 'bg-primary/15 text-primary hover:bg-primary/25',
          )}
        >
          {isAdded ? <CheckCircle className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {isAdded ? 'Added' : 'Add to Pack'}
        </button>
        <button
          type="button"
          onClick={onSave}
          className={cn(
            'flex items-center justify-center rounded-xl px-2.5 py-2 transition-colors',
            isSaved
              ? 'bg-[#bf5af2]/15 text-[#bf5af2]'
              : 'bg-muted text-muted-foreground hover:text-foreground',
          )}
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function GearDetailModal({
  item,
  onClose,
  fw,
  isAdded,
  isSaved,
  onAdd,
  onSave,
}: {
  item: CatalogItem;
  onClose: () => void;
  fw: (g: number) => string;
  isAdded: boolean;
  isSaved: boolean;
  onAdd: () => void;
  onSave: () => void;
}) {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50"
      onClick={onClose}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stop propagation wrapper */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stop propagation wrapper */}
      <div
        aria-hidden="false"
        className="w-full max-w-lg bg-background rounded-t-3xl md:rounded-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg truncate">{item.name}</h2>
            <p className="text-sm text-muted-foreground">{item.seller}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-5">
          {/* Weight & Price & Rating */}
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-xl bg-card border border-border p-3 text-center">
              <p className="text-xs text-muted-foreground mb-0.5">Weight</p>
              <p className="text-xl font-bold">{fw(item.weight)}</p>
            </div>
            {item.price && (
              <div className="flex-1 rounded-xl bg-card border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Price</p>
                <p className="text-xl font-bold">${item.price}</p>
              </div>
            )}
            {item.ratingValue && (
              <div className="flex-1 rounded-xl bg-card border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Rating</p>
                <p className="text-xl font-bold flex items-center justify-center gap-1">
                  <Star className="h-4 w-4 fill-[#ff9f0a] text-[#ff9f0a]" />
                  {item.ratingValue.toFixed(1)}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Description</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
          </div>

          {/* Specs */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Specifications</h3>
            <div className="rounded-xl bg-card border border-border divide-y divide-border">
              {item.material && (
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-muted-foreground">Material</span>
                  <span className="text-sm font-medium">{item.material}</span>
                </div>
              )}
              {item.color && (
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-muted-foreground">Color</span>
                  <span className="text-sm font-medium">{item.color}</span>
                </div>
              )}
              {item.size && (
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-muted-foreground">Size</span>
                  <span className="text-sm font-medium">{item.size}</span>
                </div>
              )}
              {item.availability && (
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-muted-foreground">Availability</span>
                  <span
                    className={cn(
                      'text-sm font-medium',
                      item.availability === 'in_stock' ? 'text-[#30d158]' : 'text-[#fe4336]',
                    )}
                  >
                    {item.availability === 'in_stock'
                      ? 'In Stock'
                      : item.availability === 'out_of_stock'
                        ? 'Out of Stock'
                        : 'Preorder'}
                  </span>
                </div>
              )}
              {item.reviewCount && (
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-muted-foreground">Reviews</span>
                  <span className="text-sm font-medium">{item.reviewCount.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Categories */}
          {item.categories && item.categories.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Categories</h3>
              <div className="flex flex-wrap gap-2">
                {item.categories.map((cat) => (
                  <span
                    key={cat}
                    className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground capitalize"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border p-4 flex gap-3">
          <button
            type="button"
            onClick={onSave}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl border py-2.5 px-4 text-sm font-semibold transition-colors',
              isSaved
                ? 'bg-[#bf5af2]/10 border-[#bf5af2]/20 text-[#bf5af2]'
                : 'bg-card border-border text-foreground hover:bg-muted',
            )}
          >
            <BookmarkPlus className={cn('h-4 w-4', isSaved && 'fill-current')} />
            {isSaved ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onAdd}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors',
              isAdded ? 'bg-[#30d158] text-white' : 'bg-primary text-white',
            )}
          >
            {isAdded ? <CheckCircle className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isAdded ? 'Added to Pack' : 'Add to Pack'}
          </button>
        </div>
      </div>
    </div>
  );
}
