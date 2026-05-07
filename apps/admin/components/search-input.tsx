'use client';

import { Input } from '@packrat/web-ui/components/input';
import { Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState, useTransition } from 'react';

interface SearchInputProps {
  placeholder?: string;
  paramKey?: string;
}

function SearchInputInner({ placeholder = 'Search…', paramKey = 'q' }: SearchInputProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const urlValue = searchParams?.get(paramKey) ?? '';
  const [inputValue, setInputValue] = useState(urlValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep input in sync if URL changes externally (e.g. browser back)
  useEffect(() => {
    setInputValue(urlValue);
  }, [urlValue]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setInputValue(next);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams?.toString() ?? '');
        if (next) {
          params.set(paramKey, next);
        } else {
          params.delete(paramKey);
        }
        // Also reset pagination when search changes
        params.delete('page');
        startTransition(() => {
          router.replace(`?${params.toString()}`, { scroll: false });
        });
      }, 300);
    },
    [router, searchParams, paramKey],
  );

  return (
    <div className="relative max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input
        value={inputValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  );
}

function SearchInputFallback({ placeholder }: Pick<SearchInputProps, 'placeholder'>) {
  return (
    <div className="relative max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input placeholder={placeholder ?? 'Search…'} className="pl-9" disabled />
    </div>
  );
}

export function SearchInput(props: SearchInputProps) {
  return (
    <Suspense fallback={<SearchInputFallback placeholder={props.placeholder} />}>
      <SearchInputInner {...props} />
    </Suspense>
  );
}
