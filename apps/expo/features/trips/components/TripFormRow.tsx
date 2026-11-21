import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import type { MaterialIconName } from 'expo-app/components/Icon/types';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Pressable, View } from 'react-native';

/** A section heading in the trip form: Where, When, Pack. */
export function TripFormHeading({ title }: { title: string }) {
  return (
    <Text variant="subhead" className="mb-1 px-1 font-medium text-primary">
      {title}
    </Text>
  );
}

interface TripFormRowProps {
  icon: MaterialIconName;
  iconColor?: string;
  /** The chosen value, or the prompt when nothing is chosen. */
  title: string;
  supporting?: string;
  isSet: boolean;
  error?: string;
  onPress: () => void;
  /** Shown as a trailing clear button when the row has a value. */
  onClear?: () => void;
  clearLabel?: string;
  testID?: string;
}

/**
 * One Material 3 list item in the trip form. The whole row opens its picker; a set value gets a
 * trailing clear button.
 */
export function TripFormRow({
  icon,
  iconColor,
  title,
  supporting,
  isSet,
  error,
  onPress,
  onClear,
  clearLabel,
  testID,
}: TripFormRowProps) {
  const { colors } = useColorScheme();
  return (
    <View>
      <View
        className={`flex-row items-center overflow-hidden rounded-2xl border bg-card ${
          error ? 'border-destructive' : 'border-border'
        }`}
      >
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          testID={testID}
          android_ripple={{ color: colors.grey4 }}
          className="min-h-14 flex-1 flex-row items-center gap-4 py-3 pl-4 pr-2"
        >
          <Icon name={icon} size={24} color={isSet ? (iconColor ?? colors.primary) : colors.grey} />
          <View className="flex-1">
            <Text
              variant="body"
              numberOfLines={1}
              className={isSet ? 'text-foreground' : 'text-primary'}
            >
              {title}
            </Text>
            {supporting ? (
              <Text variant="subhead" numberOfLines={1} className="text-muted-foreground">
                {supporting}
              </Text>
            ) : null}
          </View>
          {!onClear || !isSet ? <Icon name="chevron-right" size={24} color={colors.grey} /> : null}
        </Pressable>
        {onClear && isSet ? (
          <Pressable
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
            android_ripple={{ color: colors.grey4, borderless: true, radius: 22 }}
            className="h-12 w-12 items-center justify-center"
          >
            <Icon name="close" size={22} color={colors.grey} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="mt-1 px-4 text-sm text-destructive">{error}</Text> : null}
    </View>
  );
}
