import * as React from 'react';

type ItemProps = {
  label: string;
  value: string | number;
};

type PickerProps = {
  selectedValue?: string | number | null;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

function PickerItem(_props: ItemProps) {
  return null;
}

function Picker({ selectedValue, onValueChange, children }: PickerProps) {
  const options: ItemProps[] = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement<ItemProps>(child) && child.type === PickerItem) {
      options.push(child.props);
    }
  });

  return (
    <select
      value={selectedValue ?? ''}
      onChange={(e) => onValueChange?.(e.target.value)}
      style={{
        display: 'block',
        width: '100%',
        padding: '8px',
        borderRadius: '6px',
        border: '1px solid #ccc',
        fontSize: '16px',
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

Picker.Item = PickerItem;

export { Picker };
