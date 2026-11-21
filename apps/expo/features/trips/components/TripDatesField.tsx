import { assertDefined } from '@packrat/guards';
import { DateTimePicker } from 'expo-app/lib/DateTimePicker';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useState } from 'react';
import { View } from 'react-native';
import { TripFormRow } from './TripFormRow';
import type { TripDatesFieldProps } from './tripDates';

const toDay = (date: Date) => {
  const day = date.toISOString().split('T')[0];
  assertDefined(day);
  return day;
};

/** Start and end as two rows, each opening a date picker. Android uses one range picker instead. */
export function TripDatesField({ startDate, endDate, error, onChange }: TripDatesFieldProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<'start' | 'end' | null>(null);
  const value = editing === 'start' ? startDate : endDate;

  return (
    <View className="gap-3">
      <TripFormRow
        icon="calendar"
        title={startDate || t('trips.startDate')}
        supporting={startDate ? t('trips.startDate') : undefined}
        isSet={!!startDate}
        onPress={() => setEditing('start')}
        testID={testIds.trips.startDateBtn}
      />
      <TripFormRow
        icon="calendar"
        title={endDate || t('trips.endDate')}
        supporting={endDate ? t('trips.endDate') : undefined}
        isSet={!!endDate}
        error={error}
        onPress={() => setEditing('end')}
        testID={testIds.trips.endDateBtn}
      />
      {editing ? (
        <DateTimePicker
          testID={editing === 'start' ? testIds.trips.startDateInput : testIds.trips.endDateInput}
          value={value ? new Date(value) : new Date()}
          mode="date"
          display="default"
          onChange={(_event, date) => {
            const which = editing;
            setEditing(null);
            if (!date) return;
            if (which === 'start') onChange({ startDate: toDay(date), endDate });
            else onChange({ startDate, endDate: toDay(date) });
          }}
        />
      ) : null}
    </View>
  );
}
