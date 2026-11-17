import { Card } from '@packrat/ui/src/card';
import { Text } from '@packrat/ui/src/text';
import { TextField } from '@packrat/ui/src/text-field';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import * as Haptics from 'expo-haptics';
import { nanoid } from 'nanoid';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useUpdateTrip } from '../hooks/useUpdateTrip';
import type { Trip } from '../types';
import { checklistSuggestions } from '../utils/tripReminderPlanner';

type ChecklistItem = NonNullable<Trip['checklist']>[number];

/**
 * A trip's Before-you-go list: the non-gear things that can stop a trip — a
 * permit, a park pass, a campsite booking. Synced with the trip, so it
 * survives a lost phone; unticked tasks feed the evening-before reminder.
 */
export function TripChecklistSection({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const updateTrip = useUpdateTrip();
  const [draft, setDraft] = useState('');

  const items = trip.checklist ?? [];
  const remaining = items.filter((item) => !item.done).length;
  const suggestions = checklistSuggestions(trip);

  const save = (checklist: ChecklistItem[]) => updateTrip({ ...trip, checklist });

  const add = (title: string) => {
    const trimmed = title.trim().slice(0, 200);
    if (!trimmed || items.some((item) => item.title.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    save([...items, { id: nanoid(), title: trimmed, done: false }]);
  };

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    save(items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  };

  const remove = (id: string) => save(items.filter((item) => item.id !== id));

  return (
    <View className="mb-6" testID={testIds.trips.checklistSection}>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-lg font-semibold text-foreground">
          {t('trips.reminders.beforeYouGo')}
        </Text>
        {items.length > 0 && (
          <Text
            variant="subhead"
            className="font-semibold text-muted-foreground"
            textColor={remaining === 0 ? colors.green : undefined}
          >
            {remaining === 0
              ? t('trips.reminders.allDone')
              : t('trips.reminders.toDo', { count: remaining })}
          </Text>
        )}
      </View>

      <Card key={items.map((item) => `${item.id}:${item.done}`).join('|')} className="py-1">
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => toggle(item.id)}
            onLongPress={() => remove(item.id)}
            className="min-h-12 flex-row items-center gap-3 border-b border-border px-4 py-3"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.done }}
            accessibilityActions={[{ name: 'delete', label: t('common.delete') }]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'delete') remove(item.id);
            }}
            testID={testIds.trips.checklistItem(item.id)}
          >
            <Icon
              name={item.done ? 'check-circle' : 'circle-outline'}
              size={22}
              color={item.done ? colors.green : colors.grey}
            />
            <Text
              variant="callout"
              className={
                item.done ? 'flex-1 text-muted-foreground line-through' : 'flex-1 text-foreground'
              }
            >
              {item.title}
            </Text>
            <Pressable
              onPress={() => remove(item.id)}
              hitSlop={8}
              accessibilityLabel={t('trips.reminders.removeTask', { title: item.title })}
            >
              <Icon name="close" size={18} color={colors.grey} />
            </Pressable>
          </Pressable>
        ))}
        <View className="px-2">
          <TextField
            value={draft}
            onChangeText={setDraft}
            placeholder={t('trips.reminders.addTaskPlaceholder')}
            returnKeyType="done"
            onSubmitEditing={() => {
              add(draft);
              setDraft('');
            }}
            materialVariant="filled"
            testID={testIds.trips.checklistAddField}
          />
        </View>
      </Card>

      {suggestions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3"
          contentContainerClassName="gap-2"
          accessibilityLabel={t('trips.reminders.suggestions')}
        >
          {suggestions.map((title) => (
            <Pressable
              key={title}
              onPress={() => add(title)}
              className="flex-row items-center gap-1 rounded-full border border-border px-3 py-1.5 active:opacity-70"
              testID={testIds.trips.checklistSuggestion(title)}
            >
              <Icon name="plus" size={16} color={colors.primary} />
              <Text variant="footnote" className="font-medium text-foreground">
                {title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
