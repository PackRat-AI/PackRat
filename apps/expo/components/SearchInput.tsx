import { assertPresent } from '@packrat/guards';
import { SearchInput as BaseSearchInput } from '@packrat/ui/src/search-input';
import { useKeyboardHideBlur } from 'expo-app/lib/hooks/useKeyboardHideBlur';
import { asNonNullableRef } from 'expo-app/lib/utils/asNonNullableRef';
import { forwardRef, useImperativeHandle, useRef } from 'react';

/**
 * Enhanced SearchInput component that automatically handles keyboard hide blur fix.
 * Drop-in replacement for the base SearchInput with built-in Android keyboard behavior fix.
 */
export const SearchInput = forwardRef<
  React.ComponentRef<typeof BaseSearchInput>,
  React.ComponentProps<typeof BaseSearchInput>
>((props, ref) => {
  const searchInputRef = useRef<React.ComponentRef<typeof BaseSearchInput>>(null);

  // Apply keyboard hide blur fix
  useKeyboardHideBlur({ textInputRef: asNonNullableRef(searchInputRef) });

  // Forward ref methods to the internal ref
  useImperativeHandle(ref, () => {
    assertPresent(searchInputRef.current);
    return searchInputRef.current;
  }, []);

  return <BaseSearchInput ref={searchInputRef} {...props} />;
});

SearchInput.displayName = 'SearchInput';
