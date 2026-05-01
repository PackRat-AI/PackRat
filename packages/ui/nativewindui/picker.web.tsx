import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@packrat/web-ui';
import type * as React from 'react';

type PickerItemProps = {
  label: string;
  value: string | number;
  color?: string;
  testID?: string;
};

export function PickerItem(_props: PickerItemProps) {
  return null;
}

type PickerProps = {
  selectedValue?: string | number;
  onValueChange?: (value: string | number, index: number) => void;
  enabled?: boolean;
  children?: React.ReactNode;
  className?: string;
  testID?: string;
};

function collectItems(children: React.ReactNode): PickerItemProps[] {
  const items: PickerItemProps[] = [];
  React.Children.forEach(children, (child) => {
    if (
      child &&
      typeof child === 'object' &&
      'props' in child &&
      child.props &&
      typeof (child.props as PickerItemProps).label === 'string'
    ) {
      items.push(child.props as PickerItemProps);
    }
  });
  return items;
}

export function Picker({
  selectedValue,
  onValueChange,
  enabled = true,
  children,
  testID,
}: PickerProps) {
  const items = collectItems(children);
  const strValue = selectedValue != null ? String(selectedValue) : undefined;

  return (
    <Select
      value={strValue}
      onValueChange={(val) => {
        const idx = items.findIndex((i) => String(i.value) === val);
        onValueChange?.(val, idx);
      }}
      disabled={!enabled}
    >
      <SelectTrigger data-testid={testID}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={String(item.value)} value={String(item.value)}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
