import type { TripActivity } from '@packrat/schemas/trips';
import { createDropdownItem, DropdownMenu } from '@packrat/ui/src/dropdown-menu';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { ALL_SCOPE, isAllScope, type Scope } from '../utils/tripStats';

const ALL_KEY = 'all';

/**
 * The year and activity filters at the top of Trip Stats: Material 3 filter chips that open a
 * menu, each reading as what's showing ("2025", "Hiking"), in one horizontally scrolling row with
 * a clear button once either narrows the record. M3 pairs a filter chip with a dropdown menu when
 * a filter has more choices than fit as separate chips, as Google Play's filter row does.
 */
export function ScopeBar({
  scope,
  years,
  activities,
  onChange,
}: {
  scope: Scope;
  years: readonly number[];
  activities: readonly TripActivity[];
  onChange: (scope: Scope) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const activityLabel = (activity: TripActivity) => t(`tripStats.activities.names.${activity}`);
  const yearLabel = scope.year != null ? String(scope.year) : t('tripStats.totals.allTime');
  const activityChipLabel =
    scope.activity != null ? activityLabel(scope.activity) : t('tripStats.scope.allActivities');

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="items-center gap-2"
    >
      <MenuChip
        label={yearLabel}
        selected={scope.year != null}
        accessibilityLabel={t('tripStats.scope.yearLabel', { value: yearLabel })}
        testID={testIds.tripStats.scopeYear}
        items={[
          { key: ALL_KEY, title: t('tripStats.totals.allTime') },
          ...years.map((year) => ({ key: String(year), title: String(year) })),
        ]}
        onPick={(key) => onChange({ ...scope, year: key === ALL_KEY ? null : Number(key) })}
      />
      {activities.length > 0 ? (
        <MenuChip
          label={activityChipLabel}
          selected={scope.activity != null}
          accessibilityLabel={t('tripStats.scope.activityLabel', { value: activityChipLabel })}
          testID={testIds.tripStats.scopeActivity}
          items={[
            { key: ALL_KEY, title: t('tripStats.scope.allActivities') },
            ...activities.map((activity) => ({ key: activity, title: activityLabel(activity) })),
          ]}
          onPick={(key) =>
            onChange({
              ...scope,
              activity: activities.find((activity) => activity === key) ?? null,
            })
          }
        />
      ) : null}
      {isAllScope(scope) ? null : (
        // Fades rather than vanishing: the tap that clears also removes it, and an instant unmount
        // cuts its ripple off before it draws.
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(250)}>
          <Pressable
            onPress={() => onChange(ALL_SCOPE)}
            hitSlop={8}
            className="h-12 w-12 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={t('tripStats.scope.showAll')}
            android_ripple={{ borderless: true, color: colors.grey5 }}
            testID={testIds.tripStats.scopeClear}
          >
            <Icon name="close-circle" size={24} color={colors.grey} />
          </Pressable>
        </Animated.View>
      )}
    </ScrollView>
  );
}

/**
 * A Material 3 filter chip with a trailing dropdown arrow: 32dp tall, 8dp corners, outlined when
 * off and filled with the selected tint when on. Drawn in React Native because the menu wraps its
 * trigger in its own Pressable, which a native Compose chip would swallow.
 */
function MenuChip({
  label,
  selected,
  items,
  onPick,
  accessibilityLabel,
  testID,
}: {
  label: string;
  selected: boolean;
  items: readonly { key: string; title: string }[];
  onPick: (key: string) => void;
  accessibilityLabel: string;
  testID: string;
}) {
  const { colors } = useColorScheme();
  return (
    <DropdownMenu
      items={items.map((item) => createDropdownItem({ actionKey: item.key, title: item.title }))}
      onItemPress={(item) => onPick(item.actionKey)}
    >
      {/* A plain View: the menu wraps its trigger in its own Pressable. */}
      <View
        testID={testID}
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected }}
        className={`h-8 flex-row items-center gap-2 rounded-lg pr-2 pl-3 ${selected ? 'bg-primary/15' : 'border'}`}
        style={selected ? undefined : { borderColor: colors.grey3 }}
      >
        {selected ? <Icon name="check" size={18} color={colors.foreground} /> : null}
        <Text variant="subhead" className="font-medium">
          {label}
        </Text>
        <Icon name="menu-down" size={18} color={colors.foreground} />
      </View>
    </DropdownMenu>
  );
}
