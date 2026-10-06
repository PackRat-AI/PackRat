'use client';

import { Badge } from '@packrat/web-ui/components/badge';
import { Button } from '@packrat/web-ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@packrat/web-ui/components/card';
import { Input } from '@packrat/web-ui/components/input';
import { Skeleton } from '@packrat/web-ui/components/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@packrat/web-ui/components/table';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getFeaturedPacks, importFeaturedPack } from 'admin-app/lib/api';
import { formatDate } from 'admin-app/lib/date';
import { queryKeys } from 'admin-app/lib/queryKeys';
import { Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatGrams, sourceLabel } from './format';

function ImportCard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');

  const { mutate, isPending, error, reset } = useMutation({
    mutationFn: importFeaturedPack,
    onSuccess: (template) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.featuredPacks.all() });
      setUrl('');
      router.push(`/dashboard/featured-packs?id=${encodeURIComponent(template.id)}`);
    },
  });

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">Import from a creator post</CardTitle>
        <CardDescription>
          Paste a TikTok or YouTube "what I pack" link. The gear list is extracted and matched to
          the catalog, then saved as a draft for you to review before publishing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) mutate(url.trim());
          }}
        >
          <Input
            type="url"
            required
            placeholder="https://www.tiktok.com/@creator/video/…"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) reset();
            }}
            disabled={isPending}
            aria-label="Creator post URL"
          />
          <Button type="submit" disabled={isPending || !url.trim()}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing…
              </>
            ) : (
              'Import'
            )}
          </Button>
        </form>
        {isPending && (
          <p className="text-xs text-muted-foreground mt-2">
            Analysing the post usually takes 20–60 seconds.
          </p>
        )}
        {error && <p className="text-sm text-destructive mt-2">{error.message}</p>}
      </CardContent>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={`skeleton-row-${i}`}
          className="flex gap-4 px-4 py-3 border-b border-border/30 last:border-0"
        >
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function FeaturedPackList() {
  const router = useRouter();
  const {
    data: templates,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.admin.featuredPacks.all(),
    queryFn: getFeaturedPacks,
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Featured Packs</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Curated pack templates every user sees. Drafts stay hidden from the apps until published.
        </p>
      </div>

      <ImportCard />

      {isError ? (
        <p className="text-sm text-destructive py-4">
          Failed to load featured packs. Check that the API is reachable.
        </p>
      ) : isLoading ? (
        <ListSkeleton />
      ) : !templates?.length ? (
        <div className="rounded-lg border border-dashed border-border/60 py-12 text-center">
          <Sparkles className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">No featured packs yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Import a creator post above to create the first one.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/dashboard/featured-packs?id=${encodeURIComponent(t.id)}`)
                  }
                >
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    {t.isAppTemplate ? (
                      <Badge>Published</Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">{t.category}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {t.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px] font-normal">
                          {tag}
                        </Badge>
                      ))}
                      {t.tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{t.tags.length - 3}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{t.itemCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatGrams(t.totalWeightGrams)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {sourceLabel(t.contentSource)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDate(new Date(t.updatedAt))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
