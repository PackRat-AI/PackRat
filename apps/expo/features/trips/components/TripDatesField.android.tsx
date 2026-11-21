import { DateRangePickerDialog } from '@expo/ui/jetpack-compose';
import { ThemedHost } from '@packrat/ui/src/themed-host';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useState } from 'react';
import { View } from 'react-native';
import { TripFormRow } from './TripFormRow';
import { formatTripRange, type TripDatesFieldProps, tripDayCount } from './tripDates';

const toDay = (date: Date) => date.toISOString().slice(0, 10);

/** One Dates row opening the Material 3 date range picker, where both dates are chosen at once. */
export function TripDatesField({ startDate, endDate, error, onChange }: TripDatesFieldProps) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const [open, setOpen] = useState(false);
  const isSet = !!startDate && !!endDate;

  return (
    <View testID={testIds.trips.datesSection}>
      <TripFormRow
        icon="calendar"
        title={isSet ? formatTripRange({ startDate, endDate }) : t('trips.form.addDates')}
        supporting={
          isSet ? t('trips.form.days', { count: tripDayCount(startDate, endDate) }) : undefined
        }
        isSet={isSet}
        error={error}
        onPress={() => setOpen(true)}
        testID={testIds.trips.startDateBtn}
      />
      {open ? (
        <ThemedHost matchContents style={{ position: 'absolute' }}>
          <DateRangePickerDialog
            initialStartDate={startDate ? `${startDate}T00:00:00Z` : null}
            initialEndDate={endDate ? `${endDate}T00:00:00Z` : null}
            color={colors.primary}
            confirmButtonLabel={t('common.ok')}
            dismissButtonLabel={t('common.cancel')}
            onDateRangeSelected={({ start, end }) => {
              setOpen(false);
              if (start && end) onChange({ startDate: toDay(start), endDate: toDay(end) });
            }}
            onDismissRequest={() => setOpen(false)}
          />
        </ThemedHost>
      ) : null}
    </View>
  );
}
