'use client';

import { makeEnumGuard } from '@packrat/guards';
import { Badge } from '@packrat/web-ui/components/badge';
import { Button } from '@packrat/web-ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@packrat/web-ui/components/card';
import { Input } from '@packrat/web-ui/components/input';
import { Label } from '@packrat/web-ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@packrat/web-ui/components/select';
import { Skeleton } from '@packrat/web-ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@packrat/web-ui/components/table';
import { Textarea } from '@packrat/web-ui/components/textarea';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DeleteButton } from 'admin-app/components/delete-button';
import { formatGrams, TEMPLATE_CATEGORIES } from 'admin-app/components/featured-packs/format';
import { PackItemsCard } from 'admin-app/components/pack-items-editor';
import {
  type AdminPackDetail,
  type AdminPackUpdateBody,
  addPackItem,
  deletePack,
  deletePackItem,
  getPack,
  updatePack,
  updatePackItem,
} from 'admin-app/lib/api';
import { queryKeys } from 'admin-app/lib/queryKeys';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

const isPackCategory = makeEnumGuard(TEMPLATE_CATEGORIES);

function useInvalidate(id: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.packs.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.packs.detail(id) });
  };
}

function DetailsCard({ pack }: { pack: AdminPackDetail }) {
  const invalidate = useInvalidate(pack.id);
  const [name, setName] = useState(pack.name);
  const [description, setDescription] = useState(pack.description ?? '');
  const [category, setCategory] = useState(pack.category);
  const [tags, setTags] = useState(pack.tags.join(', '));

  const changes = useMemo<AdminPackUpdateBody>(() => {
    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const next: AdminPackUpdateBody = {};
    if (name.trim() && name.trim() !== pack.name) next.name = name.trim();
    if (description !== (pack.description ?? '')) next.description = description || null;
    if (category !== pack.category && isPackCategory(category)) next.category = category;
    if (parsedTags.join(',') !== pack.tags.join(',')) next.tags = parsedTags;
    return next;
  }, [name, description, category, tags, pack]);
  const isDirty = Object.keys(changes).length > 0;

  const {
    mutate: save,
    isPending,
    error,
  } = useMutation({
    mutationFn: () => updatePack({ id: pack.id, changes }),
    onSuccess: invalidate,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pack-name">Name</Label>
            <Input id="pack-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pack-description">Description</Label>
          <Textarea
            id="pack-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pack-tags">Tags</Label>
          <Input
            id="pack-tags"
            value={tags}
            placeholder="2-3 days, alpine, hiking"
            onChange={(e) => setTags(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Comma-separated.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => save()} disabled={!isDirty || isPending}>
            {isPending ? 'Saving…' : 'Save details'}
          </Button>
          {error && <p className="text-sm text-destructive">{error.message}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// User-made packs are shown as-is: admins review them but never rewrite them.
function ReadOnlyItemsCard({ pack }: { pack: AdminPackDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Items · {pack.itemCount} · {formatGrams(pack.totalWeightGrams)}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead className="text-right">Qty</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pack.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                  No items.
                </TableCell>
              </TableRow>
            ) : (
              pack.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm">{item.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.category ?? '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {item.weight} {item.weightUnit}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{item.quantity}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PublishControl({ pack }: { pack: AdminPackDetail }) {
  const invalidate = useInvalidate(pack.id);
  const { mutate, isPending, error } = useMutation({
    mutationFn: (isPublic: boolean) => updatePack({ id: pack.id, changes: { isPublic } }),
    onSuccess: invalidate,
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={pack.isPublic ? 'outline' : 'default'}
        disabled={isPending || (!pack.isPublic && pack.itemCount === 0)}
        onClick={() => mutate(!pack.isPublic)}
      >
        {isPending ? 'Saving…' : pack.isPublic ? 'Unpublish' : 'Publish'}
      </Button>
      {error && <p className="text-xs text-destructive">{error.message}</p>}
    </div>
  );
}

function statusLine(pack: AdminPackDetail) {
  if (pack.isPublic) return 'Public. Anyone can find and copy this pack.';
  if (pack.isAIGenerated) return 'Draft. Only admins can see it. Review the items, then publish.';
  return 'Private to its owner.';
}

export function PackDetail({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const invalidate = useInvalidate(id);
  const {
    data: pack,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.admin.packs.detail(id),
    queryFn: () => getPack(id),
  });

  const back = (
    <Link
      href="/dashboard/packs"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
    >
      <ArrowLeft className="w-4 h-4" />
      Packs
    </Link>
  );

  if (isLoading) {
    return (
      <div>
        {back}
        <Skeleton className="h-8 w-72 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !pack) {
    return (
      <div>
        {back}
        <p className="text-sm text-destructive">{error?.message ?? 'Pack not found.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        {back}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{pack.name}</h2>
              {pack.isAIGenerated && <Badge variant="secondary">AI</Badge>}
              {pack.isPublic ? (
                <Badge>Public</Badge>
              ) : pack.isAIGenerated ? (
                <Badge variant="outline">Draft</Badge>
              ) : null}
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {statusLine(pack)} Owner: {pack.ownerEmail ?? 'Unknown'}
            </p>
          </div>
          <div className="flex items-start gap-2">
            {pack.isAIGenerated && <PublishControl pack={pack} />}
            <DeleteButton
              label={pack.name}
              description="The pack will be soft-deleted and hidden from all users."
              onConfirm={async () => {
                await deletePack(pack.id);
                queryClient.invalidateQueries({ queryKey: queryKeys.admin.packs.all() });
                router.push('/dashboard/packs');
              }}
            />
          </div>
        </div>
      </div>

      {pack.isAIGenerated ? (
        <>
          <DetailsCard key={pack.updatedAt} pack={pack} />
          <PackItemsCard
            items={pack.items}
            itemCount={pack.itemCount}
            totalWeightGrams={pack.totalWeightGrams}
            actions={{
              add: (item) => addPackItem({ packId: pack.id, item }),
              update: updatePackItem,
              remove: deletePackItem,
              invalidate,
              removeDescription: 'The item is removed from this pack.',
            }}
          />
        </>
      ) : (
        <ReadOnlyItemsCard pack={pack} />
      )}
    </div>
  );
}
