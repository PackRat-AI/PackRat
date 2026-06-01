import type * as React from 'react';

type DateTimePickerEvent = { type: string; nativeEvent: { timestamp: number } };

type Props = {
  value: Date;
  mode?: 'date' | 'time' | 'datetime';
  onChange?: (event: DateTimePickerEvent, date?: Date) => void;
  display?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  style?: unknown;
};

function toInputValue(date: Date, mode: Props['mode']): string {
  if (mode === 'time') return date.toTimeString().slice(0, 5);
  if (mode === 'datetime')
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return date.toISOString().split('T')[0] ?? '';
}

export default function DateTimePicker({
  value,
  mode = 'date',
  onChange,
  minimumDate,
  maximumDate,
}: Props) {
  const inputType = mode === 'time' ? 'time' : mode === 'datetime' ? 'datetime-local' : 'date';

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!onChange) return;
    const raw = e.target.value;
    if (!raw) return;
    const date = new Date(mode === 'time' ? `1970-01-01T${raw}` : raw);
    onChange({ type: 'set', nativeEvent: { timestamp: date.getTime() } }, date);
  }

  return (
    <input
      type={inputType}
      defaultValue={toInputValue(value, mode)}
      min={minimumDate ? toInputValue(minimumDate, mode) : undefined}
      max={maximumDate ? toInputValue(maximumDate, mode) : undefined}
      onChange={handleChange}
      style={{
        display: 'block',
        padding: '8px',
        borderRadius: '6px',
        border: '1px solid #ccc',
        width: '100%',
        fontSize: '16px',
        marginTop: '8px',
      }}
    />
  );
}
