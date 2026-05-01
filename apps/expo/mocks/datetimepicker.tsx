// Web implementation for @react-native-community/datetimepicker.
// Uses a native <input type="date"> element which the browser renders natively.
import type React from 'react';

type DateTimePickerEvent = { type: string; nativeEvent: { timestamp: number } };

type Props = {
  value: Date;
  mode?: 'date' | 'time' | 'datetime';
  display?: string;
  onChange?: (event: DateTimePickerEvent, date?: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
};

function toInputValue(date: Date, mode: string): string {
  if (mode === 'time') {
    return date.toTimeString().slice(0, 5);
  }
  return date.toISOString().split('T')[0] ?? '';
}

export default function DateTimePicker({ value, mode = 'date', onChange }: Props) {
  const inputType = mode === 'time' ? 'time' : 'date';

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!onChange) return;
    const raw = e.target.value;
    const date = mode === 'time' ? new Date(`1970-01-01T${raw}`) : new Date(raw);
    onChange({ type: 'set', nativeEvent: { timestamp: date.getTime() } }, date);
  }

  return (
    <input
      type={inputType}
      defaultValue={toInputValue(value, mode)}
      onChange={handleChange}
      style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc', fontSize: 16 }}
    />
  );
}
