import DateTimePicker from '@expo/ui/community/datetime-picker';
import { Text } from '@packrat/ui/src/text';
import { format } from 'date-fns';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

/**
 * A list row holding a date and a time, each opening its own Material picker. Android has no
 * combined date-and-time picker, so the two halves are picked separately.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  minimumDate,
  testID,
}: {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  testID?: string;
}) {
  const { colors } = useColorScheme();
  const [open, setOpen] = useState<'date' | 'time' | null>(null);

  const apply = (picked: Date) => {
    const next = new Date(value);
    if (open === 'date')
      next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
    else next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
    onChange(minimumDate && next < minimumDate ? minimumDate : next);
  };

  return (
    <View className="min-h-14 flex-row items-center gap-4 px-4 py-1" testID={testID}>
      <Icon name="clock-outline" size={24} color={colors.grey} />
      <View className="flex-1">
        <Text variant="body" numberOfLines={1}>
          {label}
        </Text>
        <View className="-ml-2 flex-row">
          <Pressable
            onPress={() => setOpen('date')}
            accessibilityRole="button"
            android_ripple={{ color: colors.grey5 }}
            className="rounded-lg px-2 py-1.5"
            testID={testID ? `${testID}-date` : undefined}
          >
            <Text variant="body" className="text-primary">
              {format(value, 'EEE d MMM')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setOpen('time')}
            accessibilityRole="button"
            android_ripple={{ color: colors.grey5 }}
            className="rounded-lg px-2 py-1.5"
            testID={testID ? `${testID}-time` : undefined}
          >
            <Text variant="body" className="text-primary">
              {format(value, 'p')}
            </Text>
          </Pressable>
        </View>
      </View>
      {open ? (
        <DateTimePicker
          value={value}
          mode={open}
          display="default"
          minimumDate={open === 'date' ? minimumDate : undefined}
          onChange={(_event, date) => {
            setOpen(null);
            if (date) apply(date);
          }}
        />
      ) : null}
    </View>
  );
}
