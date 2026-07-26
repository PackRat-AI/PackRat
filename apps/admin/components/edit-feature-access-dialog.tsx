'use client';

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
import { Textarea } from '@packrat/web-ui/components/textarea';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type AdminFeatureAccessItem, updateFeatureAccessRow } from 'admin-app/lib/api';
import { queryKeys } from 'admin-app/lib/queryKeys';
import { Pencil } from 'lucide-react';
import { useState } from 'react';

interface EditFeatureAccessDialogProps {
  item: AdminFeatureAccessItem;
}

export function EditFeatureAccessDialog({ item }: EditFeatureAccessDialogProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { mutate, isPending, error } = useMutation({
    mutationFn: (body: {
      label?: string;
      description?: string | null;
      earlyAccessUntil?: string | null;
    }) => updateFeatureAccessRow({ key: item.key, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.featureAccess.all() });
      setOpen(false);
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const label = fd.get('label')?.toString().trim() || undefined;
    const description = fd.get('description')?.toString().trim();
    const dateRaw = fd.get('earlyAccessUntil')?.toString().trim();
    mutate({
      label,
      description: description ? description : null,
      earlyAccessUntil: dateRaw ? new Date(dateRaw).toISOString() : null,
    });
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
          <DialogTitle>Edit {item.key}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="label">Label</Label>
            <Input id="label" name="label" defaultValue={item.label} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">
              Paywall description{' '}
              <span className="text-muted-foreground text-xs">
                (shown on the early-access paywall)
              </span>
            </Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={item.description ?? ''}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="earlyAccessUntil">
              Early access until{' '}
              <span className="text-muted-foreground text-xs">
                (clear to graduate — free for everyone)
              </span>
            </Label>
            <Input
              id="earlyAccessUntil"
              name="earlyAccessUntil"
              type="date"
              defaultValue={item.earlyAccessUntil ? item.earlyAccessUntil.slice(0, 10) : undefined}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error.message}</p>}
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
