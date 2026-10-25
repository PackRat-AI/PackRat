'use client';

import { makeEnumGuard } from '@packrat/guards';
import { Button } from '@packrat/web-ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@packrat/web-ui/components/card';
import { Input } from '@packrat/web-ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@packrat/web-ui/components/select';
import { Switch } from '@packrat/web-ui/components/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@packrat/web-ui/components/table';
import { useMutation } from '@tanstack/react-query';
import { DeleteButton } from 'admin-app/components/delete-button';
import type {
  AdminPackTemplateItem,
  AdminPackTemplateItemCreateBody,
  AdminPackTemplateItemUpdateBody,
} from 'admin-app/lib/api';
import { useMemo, useState } from 'react';
import { formatGrams } from './featured-packs/format';

// Editable item table shared by featured packs and AI-generated pack review.
// Each caller wires its own endpoints through `actions`.

const WEIGHT_UNITS = Object.freeze(['g', 'kg', 'oz', 'lb'] as const);
const isWeightUnit = makeEnumGuard(WEIGHT_UNITS);

export interface PackItemActions {
  add: (item: AdminPackTemplateItemCreateBody) => Promise<unknown>;
  update: (args: { id: string; changes: AdminPackTemplateItemUpdateBody }) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  invalidate: () => void;
  removeDescription: string;
}

function ItemRow({ item, actions }: { item: AdminPackTemplateItem; actions: PackItemActions }) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category ?? '');
  const [weight, setWeight] = useState(String(item.weight));
  const [unit, setUnit] = useState(item.weightUnit);
  const [quantity, setQuantity] = useState(String(item.quantity));

  const changes = useMemo<AdminPackTemplateItemUpdateBody>(() => {
    const next: AdminPackTemplateItemUpdateBody = {};
    const w = Number(weight);
    const q = Number.parseInt(quantity, 10);
    if (name.trim() && name.trim() !== item.name) next.name = name.trim();
    if (category !== (item.category ?? '')) next.category = category.trim() || null;
    if (Number.isFinite(w) && w >= 0 && w !== item.weight) next.weight = w;
    if (unit !== item.weightUnit && isWeightUnit(unit)) next.weightUnit = unit;
    if (Number.isInteger(q) && q > 0 && q !== item.quantity) next.quantity = q;
    return next;
  }, [name, category, weight, unit, quantity, item]);
  const isDirty = Object.keys(changes).length > 0;

  const update = useMutation({
    mutationFn: (body: AdminPackTemplateItemUpdateBody) =>
      actions.update({ id: item.id, changes: body }),
    onSuccess: actions.invalidate,
  });

  return (
    <TableRow>
      <TableCell className="min-w-56">
        <Input className="h-8" value={name} onChange={(e) => setName(e.target.value)} />
        {item.catalogItemId === null && (
          <p className="text-[11px] text-muted-foreground mt-1">Not matched to catalog</p>
        )}
      </TableCell>
      <TableCell className="w-40">
        <Input className="h-8" value={category} onChange={(e) => setCategory(e.target.value)} />
      </TableCell>
      <TableCell className="w-28">
        <Input
          className="h-8 text-right tabular-nums"
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
      </TableCell>
      <TableCell className="w-24">
        <Select value={unit} onValueChange={setUnit}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEIGHT_UNITS.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="w-20">
        <Input
          className="h-8 text-right tabular-nums"
          inputMode="numeric"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </TableCell>
      <TableCell className="w-16">
        <Switch
          checked={item.worn}
          disabled={update.isPending}
          onCheckedChange={(worn) => update.mutate({ worn })}
          aria-label={`Worn: ${item.name}`}
        />
      </TableCell>
      <TableCell className="w-16">
        <Switch
          checked={item.consumable}
          disabled={update.isPending}
          onCheckedChange={(consumable) => update.mutate({ consumable })}
          aria-label={`Consumable: ${item.name}`}
        />
      </TableCell>
      <TableCell className="w-32 text-right">
        <div className="flex items-center justify-end gap-1">
          {isDirty && (
            <Button
              size="sm"
              className="h-7"
              disabled={update.isPending}
              onClick={() => update.mutate(changes)}
            >
              Save
            </Button>
          )}
          <DeleteButton
            label={item.name}
            description={actions.removeDescription}
            onConfirm={async () => {
              await actions.remove(item.id);
              actions.invalidate();
            }}
          />
        </div>
        {update.error && (
          <p className="text-[11px] text-destructive mt-1">{update.error.message}</p>
        )}
      </TableCell>
    </TableRow>
  );
}

function AddItemRow({ actions }: { actions: PackItemActions }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<(typeof WEIGHT_UNITS)[number]>('g');
  const [quantity, setQuantity] = useState('1');

  const w = Number(weight);
  const q = Number.parseInt(quantity, 10);
  const isValid = name.trim().length > 0 && weight !== '' && Number.isFinite(w) && w >= 0 && q > 0;

  const add = useMutation({
    mutationFn: () =>
      actions.add({
        name: name.trim(),
        category: category.trim() || null,
        weight: w,
        weightUnit: unit,
        quantity: q,
      }),
    onSuccess: () => {
      setName('');
      setCategory('');
      setWeight('');
      setQuantity('1');
      actions.invalidate();
    },
  });

  return (
    <TableRow>
      <TableCell className="min-w-56">
        <Input
          className="h-8"
          placeholder="New item name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </TableCell>
      <TableCell className="w-40">
        <Input
          className="h-8"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </TableCell>
      <TableCell className="w-28">
        <Input
          className="h-8 text-right tabular-nums"
          inputMode="decimal"
          placeholder="0"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
      </TableCell>
      <TableCell className="w-24">
        <Select value={unit} onValueChange={(u) => isWeightUnit(u) && setUnit(u)}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEIGHT_UNITS.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="w-20">
        <Input
          className="h-8 text-right tabular-nums"
          inputMode="numeric"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </TableCell>
      <TableCell colSpan={2} />
      <TableCell className="w-32 text-right">
        <Button
          size="sm"
          className="h-7"
          disabled={!isValid || add.isPending}
          onClick={() => add.mutate()}
        >
          {add.isPending ? 'Adding…' : 'Add item'}
        </Button>
        {add.error && <p className="text-[11px] text-destructive mt-1">{add.error.message}</p>}
      </TableCell>
    </TableRow>
  );
}

export function PackItemsCard({
  items,
  itemCount,
  totalWeightGrams,
  actions,
}: {
  items: AdminPackTemplateItem[];
  itemCount: number;
  totalWeightGrams: number;
  actions: PackItemActions;
}) {
  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          (a.category ?? '').localeCompare(b.category ?? '') || a.name.localeCompare(b.name),
      ),
    [items],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Items · {itemCount} · {formatGrams(totalWeightGrams)}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Worn</TableHead>
              <TableHead>Consumable</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((item) => (
              <ItemRow key={item.id} item={item} actions={actions} />
            ))}
            <AddItemRow actions={actions} />
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
