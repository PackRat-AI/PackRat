import {
  Host,
  Text as JCText,
  LinearProgressIndicator,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, testID as testIDModifier } from '@expo/ui/jetpack-compose/modifiers';
import { Card } from '@packrat/ui/src/card';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import type { ReactNode } from 'react';
import { Pressable, TextInput, View } from 'react-native';

/**
 * One Trip Stats section: a Material 3 filled card (the app's Compose `Card`) with a Title Medium
 * heading and an optional supporting line. M3 groups related content in cards and keeps one
 * subject per card, which is how Garmin Connect and Google Fit lay out their stats feeds.
 */
export function StatsCard({
  title,
  subtitle,
  action,
  children,
  testID,
  hostsNativeView = false,
  summary,
}: {
  title: string;
  subtitle?: string | null;
  /** What a chart card shows at a glance, spoken with its heading by a screen reader. */
  summary?: string | null;
  /** A trailing control in the header row, such as an overflow menu. */
  action?: ReactNode;
  children: ReactNode;
  testID?: string;
  /**
   * The card holds a native view of its own (a map). It is drawn as a React Native surface with
   * the card's colour, radius and elevation instead of nesting one native view inside another.
   */
  hostsNativeView?: boolean;
}) {
  const Surface = hostsNativeView ? NativeViewSurface : Card;
  return (
    <Surface className="gap-3 p-4" testID={testID}>
      <View className="flex-row items-start gap-2">
        <View className="flex-1 gap-0.5">
          <Text
            variant="heading"
            className="font-medium"
            accessibilityRole="header"
            accessibilityLabel={summary ? `${title}. ${summary}` : undefined}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text variant="subhead" className="text-muted-foreground">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </Surface>
  );
}

function NativeViewSurface({
  className,
  testID,
  children,
}: {
  className: string;
  testID?: string;
  children: ReactNode;
}) {
  return (
    <View className={`rounded-xl bg-card ${className}`} style={{ elevation: 2 }} testID={testID}>
      {children}
    </View>
  );
}

/** A big number with its label, for the totals grid. */
export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-[45%] flex-1 gap-0.5 py-1">
      <Text variant="title2" className="font-semibold" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Text variant="footnote" className="text-muted-foreground">
        {label}
      </Text>
    </View>
  );
}

/**
 * Material 3 determinate `LinearProgressIndicator`, the native Compose control. A leaf control,
 * so a fixed-height `Host` sizes it; `matchContents` collapses full-width controls.
 */
export function ProgressBar({ progress }: { progress: number }) {
  const { colors } = useColorScheme();
  return (
    <Host style={{ height: 8, width: '100%' }}>
      <LinearProgressIndicator
        progress={Math.min(Math.max(progress, 0), 1)}
        color={colors.primary}
        modifiers={[fillMaxWidth()]}
      />
    </Host>
  );
}

/**
 * A Material 3 list item: 56dp minimum, 16dp insets, optional leading icon, a headline with
 * supporting text, and trailing content. Plain React Native rather than the Compose `ListItem`,
 * because a native container per row inside a scrolling column claims the vertical drag.
 */
export function StatsRow({
  icon,
  title,
  subtitle,
  trailing,
  onPress,
  testID,
  inset = true,
}: {
  icon?: string;
  title: string;
  subtitle?: string | null;
  trailing?: ReactNode;
  onPress?: () => void;
  testID?: string;
  /** False inside a card, whose padding already insets the row. */
  inset?: boolean;
}) {
  const { colors } = useColorScheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      android_ripple={onPress ? { color: colors.grey5 } : undefined}
      className={`min-h-14 flex-row items-center gap-4 py-2 ${inset ? 'px-4' : ''}`}
    >
      {icon ? <Icon name={icon} size={24} color={colors.grey} /> : null}
      <View className="flex-1 gap-0.5">
        <Text variant="body" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="subhead" className="text-muted-foreground" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {onPress && !trailing ? <Icon name="chevron-right" size={24} color={colors.grey} /> : null}
    </Pressable>
  );
}

/** A label and its value on one line, for comparison and highlight lists. */
export function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-h-10 flex-row items-center justify-between gap-4 py-1">
      <Text variant="body" className="flex-1 text-muted-foreground">
        {label}
      </Text>
      {/* Shrinks and wraps rather than squeezing the label to nothing. */}
      <Text
        variant="body"
        className="max-w-[60%] shrink text-right font-medium"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * A Material 3 two-line list item with the label as supporting text above its value, for values
 * too long to share a line with their label, such as a trip name and its length.
 */
export function StackedValueRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-h-14 justify-center gap-0.5 py-2">
      <Text variant="subhead" className="text-muted-foreground">
        {label}
      </Text>
      <Text variant="body" className="font-medium">
        {value}
      </Text>
    </View>
  );
}

/**
 * Material 3 single-choice segmented buttons, the native Compose row — M3's control for switching
 * between two to five views of the same content. A fixed-height `Host`, like other leaf controls.
 */
export function SegmentedButtons<T extends string>({
  options,
  value,
  onChange,
  label,
  testIDFor,
}: {
  options: readonly T[];
  value: NoInfer<T>;
  onChange: (value: NoInfer<T>) => void;
  label: (value: NoInfer<T>) => string;
  testIDFor: (value: NoInfer<T>) => string;
}) {
  return (
    <Host style={{ height: 48 }}>
      <SingleChoiceSegmentedButtonRow>
        {options.map((option) => (
          <SegmentedButton
            key={option}
            selected={value === option}
            onClick={() => onChange(option)}
            modifiers={[testIDModifier(testIDFor(option))]}
          >
            <SegmentedButton.Label>
              <JCText>{label(option)}</JCText>
            </SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </Host>
  );
}

/**
 * Material 3 search bar: a full-width pill on the surface-container colour with a leading search
 * icon, filtering the list beneath it as the user types.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  testID,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  testID?: string;
}) {
  const { colors } = useColorScheme();
  return (
    <View
      className="mx-4 my-2 h-14 flex-row items-center gap-3 rounded-full px-4"
      style={{ backgroundColor: colors.grey6 }}
    >
      <Icon name="magnify" size={24} color={colors.grey} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.grey}
        returnKeyType="search"
        autoCorrect={false}
        testID={testID}
        className="flex-1 text-base text-foreground"
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityRole="button">
          <Icon name="close" size={20} color={colors.grey} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Material 3 extended FAB for a screen's primary action: 56dp tall, 16dp corners, the primary
 * container colour at level-3 elevation, icon then label. Drawn in React Native because the
 * Compose FAB's icon slot takes only a vector-drawable asset, not the app's icon font.
 */
export function ExtendedFab({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useColorScheme();
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
      className="absolute right-4 bottom-4 h-14 flex-row items-center gap-3 overflow-hidden rounded-2xl pr-5 pl-4"
      style={{ backgroundColor: colors.primary, elevation: 6 }}
    >
      <Icon name={icon} size={24} color="#FFFFFF" />
      <Text variant="callout" className="font-medium" style={{ color: '#FFFFFF' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The whole card opens its list, like a Material 3 clickable card. */
export function CardLink({
  onPress,
  testID,
  children,
}: {
  onPress: () => void;
  testID: string;
  children: ReactNode;
}) {
  const { colors } = useColorScheme();
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      android_ripple={{ color: colors.grey5 }}
      className="flex-row items-center gap-3"
    >
      <View className="flex-1 gap-2">{children}</View>
      <Icon name="chevron-right" size={24} color={colors.grey} />
    </Pressable>
  );
}
