'use client';

import { Input } from '@packrat/web-ui/components/input';
import { Search } from 'lucide-react';
import { parseAsString, useQueryState } from 'nuqs';

interface SearchInputProps {
  placeholder?: string;
  paramKey?: string;
  onSearch?: (value: string) => void;
}

export function SearchInput({
  placeholder = 'Search…',
  paramKey = 'q',
  onSearch,
}: SearchInputProps) {
  const [value, setValue] = useQueryState(
    paramKey,
    parseAsString
      .withDefault('')
      .withOptions({ shallow: false, throttleMs: 300, clearOnDefault: true }),
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (onSearch) {
      onSearch(e.target.value);
    } else {
      void setValue(e.target.value || null);
    }
  }

  return (
    <div className="relative max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input value={value} onChange={handleChange} placeholder={placeholder} className="pl-9" />
    </div>
  );
}
