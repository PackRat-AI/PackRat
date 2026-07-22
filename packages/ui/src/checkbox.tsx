import * as CheckboxPrimitive from '@rn-primitives/checkbox';
import { useControllableState } from '@rn-primitives/hooks';
import { Icon } from 'expo-app/components/Icon';
import { cn } from 'expo-app/lib/cn';

type CheckboxProps = Omit<CheckboxPrimitive.RootProps, 'checked' | 'onCheckedChange'> & {
  defaultChecked?: boolean;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

const HIT_SLOP = 16;

function Checkbox({
  className,
  checked: checkedProps,
  onCheckedChange: onCheckedChangeProps,
  defaultChecked = false,
  ...props
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
        props.disabled && 'opacity-50',
        className,
      )}
      checked={checked}
      onCheckedChange={onCheckedChange}
      hitSlop={HIT_SLOP}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="h-full w-full items-center justify-center">
        <Icon name="check" size={14} color="white" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
export type { CheckboxProps };
