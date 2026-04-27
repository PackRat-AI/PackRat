import { assertPresent } from '@packrat/guards';
import { SearchInput as NativeWindUISearchInput } from '@packrat/ui/nativewindui';
import { useKeyboardHideBlur } from 'app/lib/hooks/useKeyboardHideBlur';
import { asNonNullableRef } from 'app/lib/utils/asNonNullableRef';
import { forwardRef, useImperativeHandle, useRef } from 'react';

/**
 * Enhanced SearchInput component that automatically handles keyboard hide blur fix.
 * Drop-in replacement for NativeWindUI's SearchInput with built-in Android keyboard behavior fix.
 */
export const SearchInput = forwardRef<
  React.ComponentRef<typeof NativeWindUISearchInput>,
  React.ComponentProps<typeof NativeWindUISearchInput>
>((props, ref) => {
  const searchInputRef = useRef<React.ComponentRef<typeof NativeWindUISearchInput>>(null);

  // Apply keyboard hide blur fix
  useKeyboardHideBlur(asNonNullableRef(searchInputRef));

  // Forward ref methods to the internal ref
  useImperativeHandle(ref, () => {
    assertPresent(searchInputRef.current);
    return searchInputRef.current;
  }, []);

  return <NativeWindUISearchInput ref={searchInputRef} {...props} />;
});

SearchInput.displayName = 'SearchInput';
