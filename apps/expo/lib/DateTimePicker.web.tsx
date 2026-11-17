import type { DateTimePickerProps } from '@expo/ui/community/datetime-picker';
import * as React from 'react';

// @expo/ui's web DateTimePicker renders nothing, so web gets the browser's own date field.
// Callers mount the picker when the user asks for it, so it opens straight away like the native
// dialog does.

function toInputValue(date: Date | undefined): string | undefined {
  if (!date) return undefined;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// Local noon, so callers that read the day back through toISOString() land on the picked day.
function fromInputValue(value: string): Date | undefined {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day, 12);
}

function DateTimePicker({
  value,
  onChange,
  onValueChange,
  minimumDate,
  maximumDate,
  testID,
}: DateTimePickerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    try {
      input.showPicker();
    } catch {
      // showPicker needs a user gesture; the focused field still opens on click.
    }
  }, []);

  return (
    <input
      ref={inputRef}
      type="date"
      data-testid={testID}
      defaultValue={toInputValue(value)}
      min={toInputValue(minimumDate)}
      max={toInputValue(maximumDate)}
      onChange={(e) => {
        const date = fromInputValue(e.target.value);
        if (!date) return;
        const nativeEvent = { timestamp: date.getTime(), utcOffset: -date.getTimezoneOffset() };
        onValueChange?.({ nativeEvent }, date);
        onChange?.({ type: 'set', nativeEvent }, date);
      }}
      style={{
        display: 'block',
        width: '100%',
        marginTop: '8px',
        padding: '8px',
        borderRadius: '6px',
        border: '1px solid #ccc',
        fontSize: '16px',
      }}
    />
  );
}

export { DateTimePicker };
