'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@packrat/web-ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@packrat/web-ui/components/dialog';
import { Input } from '@packrat/web-ui/components/input';
import { Label } from '@packrat/web-ui/components/label';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { updateCatalogItem } from 'admin-app/lib/api';
import type { AdminCatalogItem } from 'admin-app/lib/api';

interface EditCatalogDialogProps {
  item: AdminCatalogItem;
}

export function EditCatalogDialog({ item }: EditCatalogDialogProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: (data: Parameters<typeof updateCatalogItem>[1]) =>
      updateCatalogItem(item.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'catalog'] });
      setOpen(false);
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const name = fd.get('name')?.toString().trim() ?? item.name;
    const brand = fd.get('brand')?.toString().trim() || null;
    const categoriesRaw = fd.get('categories')?.toString().trim();
    const categories = categoriesRaw
      ? categoriesRaw
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
      : null;
    const weightRaw = fd.get('weight')?.toString().trim();
    const weight = weightRaw ? Number(weightRaw) : null;
    const weightUnit = fd.get('weightUnit')?.toString().trim() || item.weightUnit;
    const priceRaw = fd.get('price')?.toString().trim();
    const price = priceRaw ? Number(priceRaw) : null;

    mutate({ name, brand, categories, weight, weightUnit, price });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground hover:text-foreground"
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit catalog item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={item.name} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brand">Brand</Label>
            <Input id="brand" name="brand" defaultValue={item.brand ?? ''} placeholder="Unknown" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="categories">
              Categories{' '}
              <span className="text-muted-foreground text-xs">(comma-separated)</span>
            </Label>
            <Input
              id="categories"
              name="categories"
              defaultValue={item.categories?.join(', ') ?? ''}
              placeholder="Hiking, Shelter"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="weight">Weight</Label>
              <Input
                id="weight"
                name="weight"
                type="number"
                step="0.01"
                defaultValue={item.weight ?? ''}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weightUnit">Unit</Label>
              <Input
                id="weightUnit"
                name="weightUnit"
                defaultValue={item.weightUnit}
                placeholder="g"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="price">Price ($)</Label>
            <Input
              id="price"
              name="price"
              type="number"
              step="0.01"
              defaultValue={item.price ?? ''}
              placeholder="0.00"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
