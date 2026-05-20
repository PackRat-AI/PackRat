'use client';

import { Input } from '@packrat/web-ui/components/input';
import { Loader2, Search } from 'lucide-react';
import { useRef } from 'react';
import { useAuth } from 'trails-app/lib/useAuth';

interface SearchBarProps {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: (query: string) => void;
}

export function SearchBar({ value, loading, onChange, onSubmit }: SearchBarProps) {
  const { isAuthed, openAuthGate } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFocus() {
    if (!isAuthed) {
      inputRef.current?.blur();
      openAuthGate();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && isAuthed) {
      onSubmit(value);
    }
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      {loading ? (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}
      <Input
        ref={inputRef}
        type="search"
        placeholder={isAuthed ? 'Search trails by name or location…' : 'Sign in to search trails'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        className="pl-9 pr-9"
        readOnly={!isAuthed}
      />
    </div>
  );
}
