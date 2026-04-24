import { Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { type ComponentProps, useState } from 'react';
import { Modal, Pressable, ScrollView, TouchableOpacity, View } from 'react-native';
import type { PackCategory } from '../types';

type ActivityPickerProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  selectText?: string;
  onSelect: (activity: PackCategory) => void;
  skipText?: string;
  onSkip?: () => void;
  defaultActivity?: PackCategory;
};

type MaterialIconProp = NonNullable<ComponentProps<typeof Icon>['materialIcon']>;

const ACTIVITIES: Array<{
  key: PackCategory;
  label: string;
  materialIcon: MaterialIconProp;
  description: string;
}> = [
  {
    key: 'hiking',
    label: 'Hiking',
    materialIcon: { type: 'MaterialCommunityIcons' as const, name: 'walk' as const },
    description: 'Day hikes and trail walking',
  },
  {
    key: 'backpacking',
    label: 'Backpacking',
    materialIcon: { type: 'MaterialCommunityIcons' as const, name: 'bag-personal' as const },
    description: 'Multi-day trips with overnight stays',
  },
  {
    key: 'camping',
    label: 'Camping',
    materialIcon: { type: 'MaterialCommunityIcons' as const, name: 'tent' as const },
    description: 'Car camping and base camping',
  },
  {
    key: 'climbing',
    label: 'Climbing',
    materialIcon: { type: 'MaterialCommunityIcons' as const, name: 'image-filter-hdr' as const },
    description: 'Rock climbing and mountaineering',
  },
  {
    key: 'winter',
    label: 'Winter Sports',
    materialIcon: { type: 'MaterialCommunityIcons' as const, name: 'snowflake' as const },
    description: 'Snow and cold weather activities',
  },
  {
    key: 'skiing',
    label: 'Skiing',
    materialIcon: { type: 'MaterialCommunityIcons' as const, name: 'ski' as const },
    description: 'Alpine and cross-country skiing',
  },
  {
    key: 'water sports',
    label: 'Water Sports',
    materialIcon: { type: 'MaterialCommunityIcons' as const, name: 'waves' as const },
    description: 'Kayaking, paddling, and water activities',
  },
  {
    key: 'desert',
    label: 'Desert',
    materialIcon: { type: 'MaterialCommunityIcons' as const, name: 'weather-sunny' as const },
    description: 'Hot and arid environment trips',
  },
  {
    key: 'custom',
    label: 'Custom',
    materialIcon: { type: 'MaterialCommunityIcons' as const, name: 'cog' as const },
    description: 'Other outdoor activities',
  },
];

export function ActivityPicker({
  open,
  onClose,
  title = 'Select Activity',
  subtitle,
  onSelect,
  onSkip,
  selectText = 'Continue',
  skipText,
  defaultActivity,
}: ActivityPickerProps) {
  const { colors } = useColorScheme();
  const [selectedActivity, setSelectedActivity] = useState<PackCategory | null>(
    defaultActivity || null,
  );

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-background">
        <View className="px-4 mb-4 py-2 border-b border-border flex-row gap-2 justify-between items-center">
          <View className="flex-row flex-1 items-center gap-2">
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <View>
              <Text className="text-lg font-semibold">{title}</Text>
              {subtitle && <Text className="text-xs text-muted-foreground">{subtitle}</Text>}
            </View>
          </View>
        </View>
        <ScrollView>
          <View className="gap-2 p-4">
            {ACTIVITIES.map((activity) => (
              <Pressable
                key={activity.key}
                onPress={() => setSelectedActivity(activity.key)}
                className={cn(
                  'flex-row items-center rounded-lg p-3 border border-border bg-card',
                  activity.key === selectedActivity && 'border-primary bg-primary/5',
                )}
                style={({ pressed }) => (pressed ? { opacity: 0.7 } : {})}
              >
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-neutral-300 dark:bg-neutral-600">
                  <Icon materialIcon={activity.materialIcon} size={20} color={colors.grey} />
                </View>
                <View className="flex-1">
                  <Text className="font-medium">{activity.label}</Text>
                  <Text className="text-xs text-muted-foreground">{activity.description}</Text>
                </View>
                {activity.key === selectedActivity && (
                  <View className="h-5 w-5 items-center justify-center rounded-full bg-primary">
                    <Icon name="check" size={14} color="white" />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <View className="px-4 pb-2 flex-row self-end items-center gap-2 justify-between">
          {onSkip && (
            <Button
              onPress={() => {
                onClose();
                onSkip();
              }}
              variant="secondary"
            >
              <Text>{skipText}</Text>
            </Button>
          )}
          <Button
            onPress={() => {
              onClose();
              if (selectedActivity) {
                onSelect(selectedActivity);
              }
            }}
            disabled={!selectedActivity}
            variant="tonal"
          >
            <Text>{selectText}</Text>
          </Button>
        </View>
      </View>
    </Modal>
  );
}
