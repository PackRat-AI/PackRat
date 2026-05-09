'use client';
import { CheckSquare, ShoppingBag, Square, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BetaBadge } from 'web-app/components/beta-badge';
import { cn } from 'web-app/lib/utils';
import { useWeight } from 'web-app/lib/weight-context';

interface ShoppingItem {
  id: string;
  name: string;
  price: number;
  weight: number;
  category: string;
  checked: boolean;
}

const mockShoppingList: ShoppingItem[] = [
  {
    id: 's1',
    name: 'Zpacks Solplex 1',
    price: 399,
    weight: 340,
    category: 'Shelter',
    checked: false,
  },
  {
    id: 's2',
    name: 'Enlightened Equipment Revelation 20°',
    price: 349,
    weight: 397,
    category: 'Sleep',
    checked: true,
  },
  {
    id: 's3',
    name: 'Therm-a-Rest NeoAir XLite Max',
    price: 229,
    weight: 340,
    category: 'Sleep',
    checked: false,
  },
  {
    id: 's4',
    name: 'Patagonia Merino Daily T-Shirt',
    price: 99,
    weight: 155,
    category: 'Clothing',
    checked: false,
  },
  {
    id: 's5',
    name: 'Garmin inReach Mini 2',
    price: 349,
    weight: 100,
    category: 'Electronics',
    checked: true,
  },
  {
    id: 's6',
    name: 'Sea to Summit Ultralight Stuff Sack',
    price: 19,
    weight: 25,
    category: 'Pack',
    checked: false,
  },
];

export function ShoppingListScreen({ onBack: _onBack }: { onBack?: () => void }) {
  const { fw } = useWeight();
  const [items, setItems] = useState<ShoppingItem[]>(mockShoppingList);

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const unchecked = useMemo(() => items.filter((i) => !i.checked), [items]);
  const checked = useMemo(() => items.filter((i) => i.checked), [items]);
  const totalCost = useMemo(() => items.reduce((sum, item) => sum + item.price, 0), [items]);
  const totalWeight = useMemo(() => items.reduce((sum, item) => sum + item.weight, 0), [items]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-3 md:px-6 md:pt-6 border-b border-border sticky top-0 z-10 bg-background">
        <div className="flex items-center gap-2 mb-3">
          <h1 className="text-2xl font-bold tracking-tight">Shopping List</h1>
          <BetaBadge />
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div>
            <p className="text-[10px] text-muted-foreground">Total Cost</p>
            <p className="font-bold text-primary">${totalCost.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Total Weight</p>
            <p className="font-bold text-primary">{fw(totalWeight)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Progress</p>
            <p className="font-bold">
              {checked.length}/{items.length}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 pb-24 space-y-4">
        {/* To Buy */}
        {unchecked.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
              To Buy ({unchecked.length})
            </h2>
            <div className="space-y-2">
              {unchecked.map((item) => (
                <ShoppingItemRow
                  key={item.id}
                  item={item}
                  fw={fw}
                  onToggle={toggleItem}
                  onRemove={removeItem}
                />
              ))}
            </div>
          </div>
        )}

        {/* Purchased */}
        {checked.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
              Purchased ({checked.length})
            </h2>
            <div className="space-y-2 opacity-60">
              {checked.map((item) => (
                <ShoppingItemRow
                  key={item.id}
                  item={item}
                  fw={fw}
                  onToggle={toggleItem}
                  onRemove={removeItem}
                />
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="font-semibold">Shopping list is empty</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add items from the catalog to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ShoppingItemRow({
  item,
  fw,
  onToggle,
  onRemove,
}: {
  item: ShoppingItem;
  fw: (g: number) => string;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-card border border-border p-4 flex items-center gap-3',
        item.checked && 'opacity-75',
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(item.id)}
        className="flex h-6 w-6 items-center justify-center text-primary shrink-0 hover:scale-110 transition-transform"
      >
        {item.checked ? <CheckSquare className="h-6 w-6" /> : <Square className="h-6 w-6" />}
      </button>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'font-semibold text-sm',
            item.checked && 'line-through text-muted-foreground',
          )}
        >
          {item.name}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{item.category}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0 text-right">
        <div>
          <p className="text-xs font-semibold text-primary">${item.price.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">{fw(item.weight)}</p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
