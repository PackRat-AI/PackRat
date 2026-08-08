import * as CheckboxPrimitive from '@rn-primitives/checkbox';
import { useControllableState } from '@rn-primitives/hooks';
import { Icon } from 'expo-app/components/Icon';
import { cn } from 'expo-app/lib/cn';
import type { CheckboxProps } from './checkbox-props';

/**
 * iOS/web implementation — Android uses `checkbox.android.tsx` (Material 3 `Checkbox`).
 *
 * This is not a stopgap: SwiftUI has no checkbox toggle style, only a switch, so putting iOS on
 * `@expo/ui` would render every checkbox as a switch. A checkmark is also the platform convention
 * here, which this already draws. Web needs a real RN fallback regardless — `@expo/ui` has no web
 * target and `apps/expo` does build for web.
 */
const HIT_SLOP = 16;

function Checkbox({
  className,
  checked: checkedProps,
  onCheckedChange: onCheckedChangeProps,
  defaultChecked = false,
  disabled,
  style,
  testID,
}: CheckboxProps) {
  const [checked = false, onCheckedChange] = useControllableState({
    prop: checkedProps,
    defaultProp: defaultChecked,
    onChange: onCheckedChangeProps,
  });
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'ios:rounded-full ios:h-[22px] ios:w-[22px] ios:border-muted-foreground border-muted h-[18px] w-[18px] rounded-sm border',
        checked && 'bg-primary border-0',
        disabled && 'opacity-50',
        className,
      )}
      style={style}
      testID={testID}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      hitSlop={HIT_SLOP}
    >
      <CheckboxPrimitive.Indicator className="h-full w-full items-center justify-center">
        <Icon name="check" size={14} color="white" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
export type { CheckboxProps };
