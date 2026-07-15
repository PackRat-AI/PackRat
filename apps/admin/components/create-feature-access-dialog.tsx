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
import { createFeatureAccessRow } from 'admin-app/lib/api';
import { queryKeys } from 'admin-app/lib/queryKeys';
import { Plus } from 'lucide-react';
import { useState } from 'react';

// Mirrors DEFAULT_EARLY_ACCESS_WEEKS in packages/config/src/featureAccess.ts —
// just the starting suggestion in the date field, not enforced server-side.
const DEFAULT_EARLY_ACCESS_WEEKS = 6;

function defaultEarlyAccessUntil(): string {
  const date = new Date(Date.now() + DEFAULT_EARLY_ACCESS_WEEKS * 7 * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

export function CreateFeatureAccessDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { mutate, isPending, error } = useMutation({
    mutationFn: createFeatureAccessRow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.featureAccess.all() });
      setOpen(false);
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const key = fd.get('key')?.toString().trim() ?? '';
    const label = fd.get('label')?.toString().trim() ?? '';
    const description = fd.get('description')?.toString().trim();
    const dateRaw = fd.get('earlyAccessUntil')?.toString().trim();
    mutate({
      key,
      label,
      description: description ? description : null,
      earlyAccessUntil: dateRaw ? new Date(dateRaw).toISOString() : null,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          New entitlement
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New feature-access entitlement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="key">Key</Label>
            <Input id="key" name="key" placeholder="ai-trip-planner" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="label">Label</Label>
            <Input id="label" name="label" placeholder="AI Trip Planner" required />
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
              placeholder="Get early access to this feature before anyone else."
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="earlyAccessUntil">
              Early access until{' '}
              <span className="text-muted-foreground text-xs">(blank = free for everyone)</span>
            </Label>
            <Input
              id="earlyAccessUntil"
              name="earlyAccessUntil"
              type="date"
              defaultValue={defaultEarlyAccessUntil()}
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
              {isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
