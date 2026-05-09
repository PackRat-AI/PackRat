'use client';
import { Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from 'web-app/lib/utils';
import { useWeight } from 'web-app/lib/weight-context';

interface InventoryItem {
  id: string;
  name: string;
  brand: string;
  weight: number;
  category: string;
}

const mockInventory: InventoryItem[] = [
  { id: 'i1', name: 'Solplex 1 Tent', brand: 'Zpacks', weight: 340, category: 'Shelter' },
  {
    id: 'i2',
    name: 'Revelation 20° Quilt',
    brand: 'Enlightened Equipment',
    weight: 397,
    category: 'Sleep System',
  },
  {
    id: 'i3',
    name: 'NeoAir XLite Max SV',
    brand: 'Therm-a-Rest',
    weight: 340,
    category: 'Sleep System',
  },
  { id: 'i4', name: 'Merino T-Shirt', brand: 'Patagonia', weight: 155, category: 'Clothing' },
  { id: 'i5', name: 'Luna Skycliff 70', brand: 'Zpacks', weight: 728, category: 'Pack' },
  { id: 'i6', name: 'Steripen Ultra', brand: 'SteriPen', weight: 93, category: 'Water' },
  { id: 'i7', name: 'Montbell Down Jacket', brand: 'Montbell', weight: 280, category: 'Clothing' },
  {
    id: 'i8',
    name: 'Garmin inReach Mini 2',
    brand: 'Garmin',
    weight: 100,
    category: 'Electronics',
  },
];

const CATEGORIES = ['All', 'Shelter', 'Sleep System', 'Clothing', 'Pack', 'Water', 'Electronics'];

export function GearInventoryScreen({ onBack: _onBack }: { onBack?: () => void }) {
  const { fw } = useWeight();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [inventory, setInventory] = useState<InventoryItem[]>(mockInventory);

  const filtered = useMemo(
    () =>
      inventory.filter((item) => {
        const matchCat = selectedCategory === 'All' || item.category === selectedCategory;
        const matchSearch =
          !search ||
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          item.brand.toLowerCase().includes(search.toLowerCase());
        return matchCat && matchSearch;
      }),
    [inventory, search, selectedCategory],
  );

  const totalWeight = useMemo(
    () => filtered.reduce((sum, item) => sum + item.weight, 0),
    [filtered],
  );

  const removeItem = (id: string) => {
    setInventory((prev) => prev.filter((item) => item.id !== id));
  };

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
          {CATEGORIES.map((cat) => (
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
        {filtered.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl bg-card border border-border p-4 flex items-center justify-between gap-3"
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{item.name}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
                  {item.category}
                </span>
                <span className="text-[11px] text-muted-foreground">{item.brand}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className="text-xs font-semibold text-primary">{fw(item.weight)}</p>
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-20 md:bottom-0 right-4 md:right-6 flex flex-col items-end gap-2 pb-4">
        <div className="rounded-2xl bg-card border border-border px-4 py-2.5 text-right">
          <p className="text-[10px] text-muted-foreground">Total Weight</p>
          <p className="text-sm font-bold text-primary">{fw(totalWeight)}</p>
        </div>
        <button
          type="button"
          className="h-12 w-12 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:bg-primary/90 transition-all active:scale-95"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
