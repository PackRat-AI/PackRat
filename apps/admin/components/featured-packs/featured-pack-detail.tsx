'use client';

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
import { Textarea } from '@packrat/web-ui/components/textarea';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DeleteButton } from 'admin-app/components/delete-button';
import { PackItemsCard } from 'admin-app/components/pack-items-editor';
import {
  type AdminPackTemplateDetail,
  type AdminPackTemplateUpdateBody,
  addFeaturedPackItem,
  deleteFeaturedPack,
  deleteFeaturedPackItem,
  getFeaturedPack,
  updateFeaturedPack,
  updateFeaturedPackItem,
} from 'admin-app/lib/api';
import { queryKeys } from 'admin-app/lib/queryKeys';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { sourceLabel, sourceUrl, TEMPLATE_CATEGORIES } from './format';

function useInvalidate(id: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.featuredPacks.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.featuredPacks.detail(id) });
  };
}

function MetadataCard({ template }: { template: AdminPackTemplateDetail }) {
  const invalidate = useInvalidate(template.id);
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? '');
  const [category, setCategory] = useState(template.category);
  const [image, setImage] = useState(template.image ?? '');
  const [tags, setTags] = useState(template.tags.join(', '));

  const changes = useMemo<AdminPackTemplateUpdateBody>(() => {
    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const next: AdminPackTemplateUpdateBody = {};
    if (name.trim() !== template.name) next.name = name.trim();
    if (description !== (template.description ?? '')) next.description = description || null;
    if (category !== template.category) next.category = category;
    if (image !== (template.image ?? '')) next.image = image.trim() || null;
    if (parsedTags.join(',') !== template.tags.join(',')) next.tags = parsedTags;
    return next;
  }, [name, description, category, image, tags, template]);
  const isDirty = Object.keys(changes).length > 0;

  const {
    mutate: save,
    isPending,
    error,
  } = useMutation({
    mutationFn: () => updateFeaturedPack({ id: template.id, changes }),
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
            <Label htmlFor="fp-name">Name</Label>
            <Input id="fp-name" value={name} onChange={(e) => setName(e.target.value)} />
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
          <Label htmlFor="fp-description">Description</Label>
          <Textarea
            id="fp-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fp-tags">Tags</Label>
          <Input
            id="fp-tags"
            value={tags}
            placeholder="2-3 days, alpine, hiking"
            onChange={(e) => setTags(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated. Include trip duration, environment and intended use — the apps show the
            first three on the card.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fp-image">Cover image URL</Label>
          <Input
            id="fp-image"
            type="url"
            value={image}
            placeholder="https://…"
            onChange={(e) => setImage(e.target.value)}
          />
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

function PublishControl({ template }: { template: AdminPackTemplateDetail }) {
  const invalidate = useInvalidate(template.id);
  const { mutate, isPending, error } = useMutation({
    mutationFn: (isAppTemplate: boolean) =>
      updateFeaturedPack({ id: template.id, changes: { isAppTemplate } }),
    onSuccess: invalidate,
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={template.isAppTemplate ? 'outline' : 'default'}
        disabled={isPending || (!template.isAppTemplate && template.itemCount === 0)}
        onClick={() => mutate(!template.isAppTemplate)}
      >
        {isPending ? 'Saving…' : template.isAppTemplate ? 'Unpublish' : 'Publish'}
      </Button>
      {error && <p className="text-xs text-destructive">{error.message}</p>}
    </div>
  );
}

export function FeaturedPackDetail({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const invalidate = useInvalidate(id);
  const {
    data: template,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.admin.featuredPacks.detail(id),
    queryFn: () => getFeaturedPack(id),
  });

  const back = (
    <Link
      href="/dashboard/featured-packs"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
    >
      <ArrowLeft className="w-4 h-4" />
      Featured Packs
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
  if (isError || !template) {
    return (
      <div>
        {back}
        <p className="text-sm text-destructive">{error?.message ?? 'Featured pack not found.'}</p>
      </div>
    );
  }

  const link = sourceUrl({ source: template.contentSource, contentId: template.contentId });

  return (
    <div className="space-y-6">
      <div>
        {back}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{template.name}</h2>
              {template.isAppTemplate ? (
                <Badge>Published</Badge>
              ) : (
                <Badge variant="secondary">Draft</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {template.isAppTemplate
                ? 'Visible to every user in the Featured Packs section.'
                : 'Hidden from the apps. Review the items, then publish.'}{' '}
              Source: {sourceLabel(template.contentSource)}
              {link && (
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 ml-1 underline underline-offset-2"
                >
                  open <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <PublishControl template={template} />
            <DeleteButton
              label={template.name}
              description="The pack is removed from Featured Packs for every user."
              onConfirm={async () => {
                await deleteFeaturedPack(template.id);
                queryClient.invalidateQueries({ queryKey: queryKeys.admin.featuredPacks.all() });
                router.push('/dashboard/featured-packs');
              }}
            />
          </div>
        </div>
      </div>

      <MetadataCard key={template.updatedAt} template={template} />
      <PackItemsCard
        items={template.items}
        itemCount={template.itemCount}
        totalWeightGrams={template.totalWeightGrams}
        actions={{
          add: (item) => addFeaturedPackItem({ templateId: template.id, item }),
          update: updateFeaturedPackItem,
          remove: deleteFeaturedPackItem,
          invalidate,
          removeDescription: 'The item is removed from this featured pack.',
        }}
      />
    </div>
  );
}
