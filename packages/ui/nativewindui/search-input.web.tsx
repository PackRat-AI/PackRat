import { type ClassValue, clsx } from 'clsx';
import { Search } from 'lucide-react';
import { forwardRef, useEffect } from 'react';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type SearchInputProps = {
  value?: string;
  onChangeText?: (text: string) => void;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onBlur?: () => void;
  onFocus?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  editable?: boolean;
  testID?: string;
  className?: string;
  containerClassName?: string;
  iconColor?: string;
  cancelText?: string;
  // RN-specific ignored on web
  containerTestID?: string;
  containerAccessibilityLabel?: string;
  iconContainerClassName?: string;
  returnKeyType?: string;
  onSubmitEditing?: () => void;
  keyboardType?: string;
  autoCapitalize?: string;
};

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChangeText,
      onChange,
      onBlur,
      onFocus,
      placeholder = 'Search…',
      autoFocus,
      editable = true,
      testID,
      className,
      containerClassName,
      iconColor,
    },
    ref,
  ) => {
    useEffect(() => {
      if (autoFocus && ref && 'current' in ref) {
        ref.current?.focus();
      }
    }, [autoFocus, ref]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChangeText?.(e.target.value);
      onChange?.(e);
    };

    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-full border border-input bg-muted px-3 py-2',
          containerClassName,
        )}
      >
        <Search
          size={16}
          style={iconColor ? { color: iconColor } : undefined}
          className="shrink-0 text-muted-foreground"
        />
        <input
          ref={ref}
          type="search"
          value={value ?? ''}
          onChange={handleChange}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          disabled={editable === false}
          data-testid={testID}
          className={cn(
            'flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground',
            className,
          )}
        />
      </div>
    );
  },
);
SearchInput.displayName = 'SearchInput';
