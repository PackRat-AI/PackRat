'use client';

import { ADMIN_AI_PACKS_MAX } from '@packrat/schemas/admin';
import { Badge } from '@packrat/web-ui/components/badge';
import { Button } from '@packrat/web-ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@packrat/web-ui/components/dialog';
import { Input } from '@packrat/web-ui/components/input';
import { Label } from '@packrat/web-ui/components/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type AdminGeneratedPack, generateAiPacks } from 'admin-app/lib/api';
import { queryKeys } from 'admin-app/lib/queryKeys';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { useState } from 'react';

function GeneratedList({ packs }: { packs: AdminGeneratedPack[] }) {
  return (
    <div className="space-y-3 py-2">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        {packs.length === 1 ? '1 pack created' : `${packs.length} packs created`}
      </p>
      <ul className="max-h-80 space-y-2 overflow-y-auto">
        {packs.map((pack) => (
          <li key={pack.id} className="rounded-md border border-border/60 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{pack.name}</span>
              <Badge variant="outline" className="text-[10px] capitalize">
                {pack.category}
              </Badge>
            </div>
            {pack.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {pack.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GenerateAiPacksDialog() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState('3');
  const queryClient = useQueryClient();

  const parsed = Number.parseInt(count, 10);
  const isValid = Number.isInteger(parsed) && parsed >= 1 && parsed <= ADMIN_AI_PACKS_MAX;

  const { mutate, data, isPending, error, reset } = useMutation({
    mutationFn: () => generateAiPacks(parsed),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.packs.all() }),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Generate with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate packs with AI</DialogTitle>
          <DialogDescription>
            Each pack gets its own theme and is filled with real catalog gear. New packs are public
            and marked AI.
          </DialogDescription>
        </DialogHeader>
        {data ? (
          <>
            <GeneratedList packs={data} />
            <DialogFooter>
              <Button variant="outline" onClick={() => reset()}>
                Generate more
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form
            className="space-y-4 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (isValid) mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="ai-pack-count">Number of packs</Label>
              <Input
                id="ai-pack-count"
                type="number"
                min={1}
                max={ADMIN_AI_PACKS_MAX}
                className="w-28 tabular-nums"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                Up to {ADMIN_AI_PACKS_MAX} at a time. Larger batches take longer.
              </p>
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
              <Button type="submit" disabled={!isValid || isPending}>
                {isPending ? 'Generating…' : 'Generate'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
