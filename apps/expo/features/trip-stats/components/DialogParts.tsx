import DateTimePicker from '@expo/ui/community/datetime-picker';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useState } from 'react';
import { Pressable, TextInput, type TextInputProps, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDay } from '../lib/useStatsFormat';

/**
 * Material 3 full-screen dialog header: a close icon, the title, and a text confirm action on
 * the right. M3 reserves full-screen dialogs for multi-field tasks on compact screens, and they
 * are the only dialog other dialogs (the date pickers) may open on top of.
 */
export function FullScreenDialogHeader({
  title,
  onClose,
  onSave,
  canSave,
}: {
  title: string;
  onClose: () => void;
  /** Left out when the screen's main action sits at the bottom instead. */
  onSave?: () => void;
  canSave?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.background }} className="h-auto">
      <View className="h-16 flex-row items-center gap-1 px-1">
        <Pressable
          onPress={onClose}
          hitSlop={8}
          className="p-3"
          accessibilityRole="button"
          accessibilityLabel={t('tripStats.dialog.close')}
          android_ripple={{ borderless: true, color: colors.grey5 }}
          testID={testIds.tripStats.dialogCloseBtn}
        >
          <Icon name="close" size={24} color={colors.foreground} />
        </Pressable>
        <Text variant="title3" className="flex-1" numberOfLines={1}>
          {title}
        </Text>
        {onSave ? (
          <Pressable
            onPress={onSave}
            disabled={!canSave}
            className="rounded-full px-3 py-2.5"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave }}
            android_ripple={{ color: colors.grey5 }}
            testID={testIds.tripStats.dialogSaveBtn}
          >
            <Text
              variant="callout"
              className="font-medium"
              style={{ color: canSave ? colors.primary : colors.grey }}
            >
              {t('tripStats.dialog.save')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** A form section label, Material's Title Small in primary. */
export function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="subhead" className="px-4 pt-4 pb-1 font-medium text-primary">
      {children}
    </Text>
  );
}

/**
 * A Material 3 outlined text field: the label sits on the border and the field takes the
 * device keyboard. React Native's `TextInput` is already the platform `EditText`.
 */
export function OutlinedField({
  label,
  testID,
  ...props
}: TextInputProps & { label: string; testID?: string }) {
  const { colors } = useColorScheme();
  const [focused, setFocused] = useState(false);
  return (
    <View className="px-4 py-1">
      {/* The label sits on the border, M3's outlined style, but inside this View's own top
          padding: a label drawn above its parent's bounds is clipped on Android. */}
      <View className="pt-2.5">
        <View
          className="rounded-md border px-3"
          style={{
            borderColor: focused ? colors.primary : colors.grey3,
            borderWidth: focused ? 2 : 1,
          }}
        >
          <TextInput
            {...props}
            testID={testID}
            onFocus={(event) => {
              setFocused(true);
              props.onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              props.onBlur?.(event);
            }}
            placeholderTextColor={colors.grey}
            className="min-h-14 text-base text-foreground"
          />
        </View>
        <Text
          variant="caption1"
          className="absolute top-0 left-2 px-1"
          style={{
            backgroundColor: colors.background,
            color: focused ? colors.primary : colors.grey,
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

/** A date row that opens the Material 3 date picker dialog. */
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  testID,
}: {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  testID?: string;
}) {
  const { colors } = useColorScheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        testID={testID}
        accessibilityRole="button"
        android_ripple={{ color: colors.grey5 }}
        className="min-h-14 flex-row items-center gap-4 px-4"
      >
        <Icon name="calendar-blank-outline" size={24} color={colors.grey} />
        <View className="flex-1">
          <Text variant="body">{label}</Text>
        </View>
        <Text variant="body" className="text-muted-foreground">
          {formatDay(value)}
        </Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={value}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(_event, date) => {
            setOpen(false);
            if (date) onChange(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
          }}
        />
      ) : null}
    </>
  );
}
