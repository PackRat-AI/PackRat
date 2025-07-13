'use client';

import { useQuery } from '@tanstack/react-query';
import { Input } from 'guides-app/components/ui/input';
import { getAllPosts } from 'guides-app/lib/mdx-static';
import type { Post } from 'guides-app/lib/types';
import { SearchIcon, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

export function Search() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Fetch posts using TanStack Query
  const { data: posts = [] } = useQuery({
    queryKey: ['posts'],
    queryFn: getAllPosts,
  });

  // Handle click outside to close search
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus input when search is opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);

    // Simple client-side search
    const searchResults = posts.filter((post) => {
      const searchContent = `${post.title} ${
        post.description
      } ${post.categories?.join(' ')}`.toLowerCase();
      return searchContent.includes(query.toLowerCase());
    });

    setResults(searchResults);
    setIsLoading(false);
  }, [query, posts]);

  // Handle search submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/?search=${encodeURIComponent(query)}`);
      setIsOpen(false);
    }
  };

  return (
    <div ref={searchRef} className="relative">
      <button
        type="button"
        className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        onClick={() => setIsOpen(true)}
        aria-label="Search"
      >
        <SearchIcon className="h-5 w-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border bg-background/95 backdrop-blur-xl shadow-lg animate-in fade-in-0 zoom-in-95 z-50">
          <div className="p-3">
            <div className="flex items-center">
              <form onSubmit={handleSubmit} className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  placeholder="Search guides..."
                  className="pl-9 rounded-full border-apple-blue/20 focus-visible:ring-apple-blue h-9"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </form>
              <button
                type="button"
                className="ml-2 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {query.trim() && (
              <div className="mt-3 max-h-80 overflow-auto">
                {isLoading ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">Searching...</div>
                ) : results.length > 0 ? (
                  <div className="space-y-1">
                    {results.map((post) => (
                      <Link
                        key={post.slug}
                        href={`/guide/${post.slug}`}
                        onClick={() => setIsOpen(false)}
                        className="block rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <div className="text-sm font-medium">{post.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {post.description}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No results found.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
