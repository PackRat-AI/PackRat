'use client';
import {
  gramsToLbs,
  useAddPackItemMutation,
  useCatalogItemsInfinite,
  useCreatePackMutation,
  useDeletePackItemMutation,
  useDeletePackMutation,
  usePacks,
  useUpdatePackItemMutation,
  useUpdatePackMutation,
} from '@packrat/app';
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  GripVertical,
  Minus,
  MoreVertical,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ConfirmDialog, PackFormModal, ShareModal } from 'web-app/components/modals';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'web-app/components/ui/dropdown-menu';
import { Skeleton } from 'web-app/components/ui/skeleton';
import type { PackItem, PackWithWeights } from 'web-app/lib/types';
import { cn } from 'web-app/lib/utils';
import { useWeight } from 'web-app/lib/weight-context';

type PacksTab = 'my-packs' | 'templates' | 'shared';

export function PacksScreen() {
  const [tab, setTab] = useState<PacksTab>('my-packs');
  const [selectedPack, setSelectedPack] = useState<PackWithWeights | null>(null);
  const { fw } = useWeight();

  const { data: packsRaw, isLoading: packsLoading } = usePacks();
  const packsData = packsRaw as PackWithWeights[] | undefined;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPack, setEditingPack] = useState<PackWithWeights | null>(null);
  const [sharingPack, setSharingPack] = useState<PackWithWeights | null>(null);
  const [deletingPack, setDeletingPack] = useState<PackWithWeights | null>(null);

  const createPack = useCreatePackMutation();
  const updatePack = useUpdatePackMutation();
  const deletePack = useDeletePackMutation();

  const isLoading = tab !== 'my-packs' ? false : packsLoading;

  if (selectedPack) {
    return (
      <PackDetail
        pack={selectedPack}
        onBack={() => setSelectedPack(null)}
        fw={fw}
        onShare={() => setSharingPack(selectedPack)}
        onEdit={() => setEditingPack(selectedPack)}
        onDelete={() => setDeletingPack(selectedPack)}
      />
    );
  }

  const displayPacks =
    tab === 'my-packs'
      ? (packsData ?? [])
      : tab === 'shared'
        ? (packsData ?? []).filter((p) => p.isPublic)
        : [];

  return (
    <div className="px-4 pt-5 pb-28 md:px-6 md:pt-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Packs</h1>
      </div>

      <div className="flex gap-1 bg-muted rounded-xl p-1 mb-5">
        {(['my-packs', 'templates', 'shared'] as PacksTab[]).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all',
              tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {t === 'my-packs' ? 'My Packs' : t === 'templates' ? 'Templates' : 'Shared'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-card border border-border p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <div className="flex gap-4">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-12" />
              </div>
              <Skeleton className="h-1.5 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {displayPacks.map((pack) => (
            <PackCard
              key={pack.id}
              pack={pack}
              fw={fw}
              onClick={() => setSelectedPack(pack)}
              onEdit={() => setEditingPack(pack)}
              onShare={() => setSharingPack(pack)}
              onDelete={() => setDeletingPack(pack)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-24 right-5 md:bottom-6 flex items-center gap-2 rounded-full bg-primary px-4 py-3 font-semibold text-sm text-white shadow-lg shadow-primary/30 transition-all active:scale-95 hover:bg-primary/90"
      >
        <Plus className="h-4.5 w-4.5" />
        New Pack
      </button>

      <PackFormModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        mode="create"
        onSave={({ name, description, tags }) => {
          createPack.mutate({ name, description, tags });
        }}
      />

      <PackFormModal
        open={!!editingPack}
        onClose={() => setEditingPack(null)}
        mode="edit"
        initialData={
          editingPack
            ? {
                name: editingPack.name,
                description: editingPack.description ?? '',
                tags: editingPack.tags ?? [],
              }
            : undefined
        }
        onSave={({ name, description, tags }) => {
          if (!editingPack) return;
          updatePack.mutate({ packId: editingPack.id, body: { name, description, tags } });
        }}
      />

      <ShareModal
        open={!!sharingPack}
        onClose={() => setSharingPack(null)}
        packName={sharingPack?.name ?? ''}
        packId={sharingPack?.id ?? ''}
      />

      <ConfirmDialog
        open={!!deletingPack}
        onClose={() => setDeletingPack(null)}
        onConfirm={() => {
          if (deletingPack) deletePack.mutate(deletingPack.id);
        }}
        title="Delete Pack?"
        description={`Are you sure you want to delete "${deletingPack?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}

function PackCard({
  pack,
  fw,
  onClick,
  onEdit,
  onShare,
  onDelete,
}: {
  pack: PackWithWeights;
  fw: (g: number) => string;
  onClick: () => void;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const targetWeight = 4536;
  const pct = Math.min((pack.baseWeight / targetWeight) * 100, 100);
  const barColor = pct < 70 ? '#30d158' : pct < 90 ? '#ff9f0a' : '#fe4336';

  return (
    <div className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between">
        <button type="button" className="flex-1 text-left" onClick={onClick}>
          <p className="font-semibold text-sm leading-tight">{pack.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{pack.description}</p>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="p-1 -mr-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border-border">
            <DropdownMenuItem onClick={onEdit} className="gap-2">
              <Edit3 className="h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShare} className="gap-2">
              <Share2 className="h-4 w-4" /> Share
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex gap-4 text-xs">
        <div>
          <p className="text-muted-foreground">Base</p>
          <p className="font-semibold text-foreground">{fw(pack.baseWeight)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Total</p>
          <p className="font-semibold text-foreground">{fw(pack.totalWeight)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Items</p>
          <p className="font-semibold text-foreground">{pack.items?.length ?? 0}</p>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{gramsToLbs(pack.baseWeight)}</span>
          <span>target {gramsToLbs(targetWeight)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: barColor }}
          />
        </div>
      </div>

      {pack.tags && pack.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {pack.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        className="flex items-center justify-between pt-2 border-t border-border text-xs text-primary font-semibold"
      >
        View Details <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Pack Detail ──────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  shelter: '#0385ff',
  sleep: '#bf5af2',
  clothing: '#ff9f0a',
  kitchen: '#30d158',
  water: '#5ac8fa',
  electronics: '#ff375f',
  navigation: '#64d2ff',
  'first-aid': '#ff6961',
  tools: '#8e8e93',
  consumables: '#ffd60a',
  miscellaneous: '#636366',
};

function PackDetail({
  pack,
  onBack,
  fw,
  onShare,
  onEdit,
  onDelete,
}: {
  pack: PackWithWeights;
  onBack: () => void;
  fw: (g: number) => string;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showAddItem, setShowAddItem] = useState(false);
  const items = pack.items ?? [];

  const updateItem = useUpdatePackItemMutation();
  const deleteItem = useDeletePackItemMutation();

  const groupedItems = useMemo(() => {
    const groups: Record<string, PackItem[]> = {};
    for (const item of items) {
      const cat = item.category ?? 'miscellaneous';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [items]);

  const chartData = useMemo(() => {
    return Object.entries(groupedItems).map(([category, catItems]) => ({
      name: category,
      value: catItems.reduce((sum, item) => sum + item.weight * item.quantity, 0),
      color: CATEGORY_COLORS[category] ?? '#8e8e93',
    }));
  }, [groupedItems]);

  return (
    <div className="flex flex-col md:flex-row min-h-full">
      <div className="flex-1 px-4 pt-5 pb-28 md:px-6 md:pt-6 overflow-y-auto">
        <div className="flex items-center gap-3 mb-5">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{pack.name}</h1>
            <p className="text-xs text-muted-foreground truncate">{pack.description}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="p-2 text-muted-foreground hover:text-foreground">
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border">
              <DropdownMenuItem onClick={onEdit} className="gap-2">
                <Edit3 className="h-4 w-4" /> Edit Pack
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onShare} className="gap-2">
                <Share2 className="h-4 w-4" /> Share
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="rounded-xl bg-card border border-border p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Base
            </p>
            <p className="text-lg font-bold text-foreground">{fw(pack.baseWeight)}</p>
          </div>
          <div className="rounded-xl bg-card border border-border p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Total
            </p>
            <p className="text-lg font-bold text-foreground">{fw(pack.totalWeight)}</p>
          </div>
          <div className="rounded-xl bg-card border border-border p-3 text-center">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Items
            </p>
            <p className="text-lg font-bold text-foreground">{items.length}</p>
          </div>
        </div>

        <div className="space-y-4">
          {Object.entries(groupedItems).map(([category, catItems]) => (
            <div key={category}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[category] ?? '#8e8e93' }}
                  />
                  <span className="text-xs font-semibold capitalize">{category}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {fw(catItems.reduce((sum, item) => sum + item.weight * item.quantity, 0))}
                </span>
              </div>
              <div className="rounded-xl bg-card border border-border divide-y divide-border overflow-hidden">
                {catItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{fw(item.weight)}</span>
                        {item.worn && (
                          <span className="text-[10px] bg-[#bf5af2]/20 text-[#bf5af2] px-1.5 py-0.5 rounded-full">
                            worn
                          </span>
                        )}
                        {item.consumable && (
                          <span className="text-[10px] bg-[#ff9f0a]/20 text-[#ff9f0a] px-1.5 py-0.5 rounded-full">
                            consumable
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (item.quantity <= 1) {
                            deleteItem.mutate({ itemId: item.id, packId: pack.id });
                          } else {
                            updateItem.mutate({
                              itemId: item.id,
                              packId: pack.id,
                              body: { quantity: item.quantity - 1 },
                            });
                          }
                        }}
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateItem.mutate({
                            itemId: item.id,
                            packId: pack.id,
                            body: { quantity: item.quantity + 1 },
                          })
                        }
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowAddItem(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-card border border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </button>
      </div>

      <div className="hidden md:block w-80 border-l border-border bg-card p-5">
        <h3 className="font-semibold text-sm mb-4">Weight Breakdown</h3>

        <div className="h-48 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length && payload[0]) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border border-border rounded-lg px-2.5 py-1.5 text-xs shadow-lg">
                        <p className="font-semibold capitalize">{data.name}</p>
                        <p className="text-muted-foreground">{fw(data.value)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="capitalize">{item.name}</span>
              </div>
              <span className="text-muted-foreground">{fw(item.value)}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-primary/10 border border-primary/20 py-2.5 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          AI Optimize
        </button>
      </div>

      {showAddItem && (
        <AddItemSlideOver packId={pack.id} onClose={() => setShowAddItem(false)} fw={fw} />
      )}
    </div>
  );
}

// ── Add Item Slide-over ──────────────────────────────────────────────────────

function AddItemSlideOver({
  packId,
  onClose,
  fw,
}: {
  packId: string;
  onClose: () => void;
  fw: (g: number) => string;
}) {
  const [search, setSearch] = useState('');
  const { data: catalogInfiniteData, isLoading } = useCatalogItemsInfinite({
    query: search || undefined,
    limit: 20,
  });
  const catalogItems = catalogInfiniteData?.pages.flatMap((p) => p.items) ?? [];

  const addItem = useAddPackItemMutation();

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      aria-hidden="true"
      onClick={onClose}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stop propagation from modal panel */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stop propagation from modal panel */}
      <div
        aria-hidden="false"
        className="w-full max-w-md bg-background border-l border-border h-full flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">Add Item</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search catalog..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl bg-muted border-0 py-2.5 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-card border border-border p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            : catalogItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    addItem.mutate(
                      {
                        packId,
                        body: {
                          name: item.name,
                          weight: item.weight,
                          weightUnit: 'g',
                          catalogItemId: item.id,
                        },
                      },
                      { onSuccess: onClose },
                    );
                  }}
                  className="w-full rounded-xl bg-card border border-border p-3 text-left hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.seller}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{fw(item.weight)}</p>
                      {item.price && <p className="text-xs text-muted-foreground">${item.price}</p>}
                    </div>
                  </div>
                </button>
              ))}
        </div>

        <div className="p-4 border-t border-border">
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Add Custom Item
          </button>
        </div>
      </div>
    </div>
  );
}
