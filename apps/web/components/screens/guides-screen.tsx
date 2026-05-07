'use client';
import { BookOpen, Clock, Loader2, Search } from 'lucide-react';
import { useState } from 'react';

// useGuides is not yet in @packrat/app — stub it inline
const useGuides = () => ({ data: [] as import('web-app/lib/types').Guide[], isLoading: false });

import { cn } from 'web-app/lib/utils';

const CATEGORIES = ['All', 'Gear Guides', 'Trip Planning', 'Ultralight Tips'];
const CATEGORY_COLORS: Record<string, string> = {
  'Gear Guides': '#0385ff',
  'Trip Planning': '#30d158',
  'Ultralight Tips': '#bf5af2',
};

export function GuidesScreen() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const { data: guides = [], isLoading } = useGuides();

  const filtered = guides.filter((a) => {
    const matchCat = category === 'All' || a.category === category;
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-3 md:px-6 md:pt-6 border-b border-border sticky top-0 z-10 bg-background">
        <h1 className="text-2xl font-bold tracking-tight mb-3">Guides</h1>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guides…"
            className="w-full rounded-xl bg-muted pl-9 pr-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors',
                category === cat
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 space-y-2 pb-24">
          {filtered.map((article) => (
            <button
              type="button"
              key={article.id}
              className="w-full rounded-2xl bg-card border border-border p-4 text-left hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
                  style={{ background: `${CATEGORY_COLORS[article.category] ?? '#636366'}20` }}
                >
                  <BookOpen
                    className="h-4.5 w-4.5"
                    style={{ color: CATEGORY_COLORS[article.category] ?? '#636366' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-snug">{article.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className="text-[10px] font-semibold rounded-full px-2 py-0.5"
                      style={{
                        background: `${CATEGORY_COLORS[article.category] ?? '#636366'}20`,
                        color: CATEGORY_COLORS[article.category] ?? '#636366',
                      }}
                    >
                      {article.category}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {article.readTime}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
