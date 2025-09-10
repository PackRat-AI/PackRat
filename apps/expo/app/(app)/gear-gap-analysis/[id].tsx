'use client';

import { ActivityIndicator, Button, LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { isAuthed } from 'expo-app/features/auth/store';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, View } from 'react-native';
import {
  type ActivityType,
  type EssentialItem,
  useGearGapAnalysis,
} from '../../features/packs/hooks/useGearGapAnalysis';

const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: string }[] = [
  { value: 'hiking', label: 'Day Hiking', icon: 'map' },
  { value: 'backpacking', label: 'Backpacking', icon: 'backpack' },
  { value: 'camping', label: 'Camping', icon: 'tent' },
  { value: 'climbing', label: 'Climbing', icon: 'mountains' },
  { value: 'winter', label: 'Winter Sports', icon: 'snowflake' },
  { value: 'desert', label: 'Desert Adventure', icon: 'sun' },
  { value: 'water sports', label: 'Water Sports', icon: 'boat' },
  { value: 'skiing', label: 'Skiing', icon: 'ski' },
  { value: 'custom', label: 'Custom Activity', icon: 'settings' },
];

function ActivitySelector({
  selectedActivity,
  onSelect,
}: {
  selectedActivity: ActivityType | null;
  onSelect: (activity: ActivityType) => void;
}) {
  const { colors } = useColorScheme();

  return (
    <View className="p-4">
      <Text variant="heading" className="mb-3 font-semibold">
        Select Activity Type
      </Text>
      <Text variant="subhead" className="mb-4 text-muted-foreground">
        Choose the type of outdoor activity to analyze your pack for
      </Text>

      <View className="grid grid-cols-3 gap-3">
        {ACTIVITY_TYPES.map((activity) => (
          <Pressable
            key={activity.value}
            onPress={() => onSelect(activity.value)}
            className={cn(
              'rounded-lg border-2 p-3 items-center',
              selectedActivity === activity.value
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card',
            )}
          >
            <Icon
              name={activity.icon}
              size={24}
              color={selectedActivity === activity.value ? colors.primary : colors.foreground}
            />
            <Text
              variant="footnote"
              className={cn(
                'mt-2 text-center',
                selectedActivity === activity.value ? 'text-primary' : 'text-foreground',
              )}
            >
              {activity.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function CompletionCard({
  completionPercentage,
  summary,
}: {
  completionPercentage: number;
  summary: { essentialMissing: number; recommendedMissing: number; optionalMissing: number };
}) {
  return (
    <View className="mx-4 mb-4 rounded-lg bg-card p-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text variant="heading" className="font-semibold">
          Pack Completeness
        </Text>
        <Text variant="title2" className="font-bold text-primary">
          {completionPercentage}%
        </Text>
      </View>

      <View className="h-2 bg-muted rounded-full mb-3">
        <View
          className="h-full bg-primary rounded-full"
          style={{ width: `${completionPercentage}%` }}
        />
      </View>

      <View className="flex-row justify-between">
        <View className="items-center">
          <Text variant="caption1" className="text-destructive font-semibold">
            {summary.essentialMissing}
          </Text>
          <Text variant="caption2" className="text-muted-foreground">
            Essential Missing
          </Text>
        </View>
        <View className="items-center">
          <Text variant="caption1" className="text-orange-500 font-semibold">
            {summary.recommendedMissing}
          </Text>
          <Text variant="caption2" className="text-muted-foreground">
            Recommended Missing
          </Text>
        </View>
        <View className="items-center">
          <Text variant="caption1" className="text-muted-foreground font-semibold">
            {summary.optionalMissing}
          </Text>
          <Text variant="caption2" className="text-muted-foreground">
            Optional Missing
          </Text>
        </View>
      </View>
    </View>
  );
}

function MissingItemCard({ item }: { item: EssentialItem }) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'essential':
        return 'text-destructive';
      case 'recommended':
        return 'text-orange-500';
      case 'optional':
        return 'text-muted-foreground';
      default:
        return 'text-muted-foreground';
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'essential':
        return 'bg-destructive/10 border-destructive/20';
      case 'recommended':
        return 'bg-orange-100 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800/30';
      case 'optional':
        return 'bg-muted border-border';
      default:
        return 'bg-muted border-border';
    }
  };

  return (
    <View className="mx-4 mb-3 rounded-lg bg-card p-4">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text variant="subhead" className="font-semibold mb-1">
            {item.name}
          </Text>
          <Text variant="footnote" className="text-muted-foreground mb-2">
            {item.category}
          </Text>
          {item.description && (
            <Text variant="footnote" className="text-muted-foreground mb-2">
              {item.description}
            </Text>
          )}
          {item.alternatives && item.alternatives.length > 0 && (
            <Text variant="caption2" className="text-muted-foreground">
              Alternatives: {item.alternatives.join(', ')}
            </Text>
          )}
        </View>
        <View className={cn('px-2 py-1 rounded-md border', getPriorityBadgeColor(item.priority))}>
          <Text variant="caption2" className={cn('font-medium', getPriorityColor(item.priority))}>
            {item.priority.toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function GearGapAnalysisScreen() {
  const params = useLocalSearchParams();
  const packId = params.id as string;
  const router = useRouter();

  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);

  const {
    data: analysis,
    isLoading,
    isError,
    refetch,
  } = useGearGapAnalysis(packId, selectedActivity || 'hiking', !!selectedActivity);

  if (!isAuthed.peek()) {
    return (
      <SafeAreaView className="flex-1">
        <LargeTitleHeader title="Gear Gap Analysis" />
        <View className="flex-1 justify-center items-center p-4">
          <Text variant="heading" className="mb-4 text-center">
            Sign in Required
          </Text>
          <Text variant="subhead" className="mb-6 text-center text-muted-foreground">
            Please sign in to analyze your pack for missing gear
          </Text>
          <Button onPress={() => router.push('/auth')} className="w-full">
            <Text>Sign In</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1">
      <LargeTitleHeader title="Gear Gap Analysis" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        removeClippedSubviews={false}
      >
        {!selectedActivity && (
          <ActivitySelector selectedActivity={selectedActivity} onSelect={setSelectedActivity} />
        )}

        {selectedActivity && isLoading && (
          <View className="p-8 items-center">
            <ActivityIndicator size="large" />
            <Text variant="subhead" className="mt-4 text-muted-foreground">
              Analyzing your pack...
            </Text>
          </View>
        )}

        {selectedActivity && isError && (
          <View className="p-4">
            <Text className="mb-4 text-center text-muted-foreground">
              Failed to analyze your pack. Please try again.
            </Text>
            <Button onPress={() => refetch()} variant="secondary" className="w-full">
              <Icon name="restart" size={16} />
              <Text>Try Again</Text>
            </Button>
          </View>
        )}

        {analysis && (
          <>
            <View className="p-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text variant="heading" className="font-semibold">
                  Analysis for {ACTIVITY_TYPES.find((t) => t.value === selectedActivity)?.label}
                </Text>
                <Button variant="outline" size="sm" onPress={() => setSelectedActivity(null)}>
                  <Text>Change Activity</Text>
                </Button>
              </View>
            </View>

            <CompletionCard
              completionPercentage={analysis.completionPercentage}
              summary={analysis.summary}
            />

            {analysis.missingItems.length > 0 ? (
              <View className="mb-4">
                <View className="px-4 mb-3">
                  <Text variant="heading" className="font-semibold mb-2">
                    Missing Items ({analysis.missingItems.length})
                  </Text>
                  <Text variant="subhead" className="text-muted-foreground">
                    Items you should consider adding to your pack
                  </Text>
                </View>

                {/* Group by priority for better organization */}
                {['essential', 'recommended', 'optional'].map((priority) => {
                  const items = analysis.missingItems.filter((item) => item.priority === priority);
                  if (items.length === 0) return null;

                  return (
                    <View key={priority}>
                      <View className="px-4 py-2">
                        <Text
                          variant="subhead"
                          className={cn(
                            'font-medium',
                            priority === 'essential'
                              ? 'text-destructive'
                              : priority === 'recommended'
                                ? 'text-orange-500'
                                : 'text-muted-foreground',
                          )}
                        >
                          {priority.charAt(0).toUpperCase() + priority.slice(1)} ({items.length})
                        </Text>
                      </View>
                      {items.map((item) => (
                        <MissingItemCard
                          key={`${priority}-${item.name}-${item.category}`}
                          item={item}
                        />
                      ))}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View className="p-8 items-center">
                <Icon name="checkmark-circle" size={48} className="text-primary mb-4" />
                <Text variant="heading" className="mb-2 text-center">
                  Pack Complete!
                </Text>
                <Text variant="subhead" className="text-center text-muted-foreground">
                  Your pack has all the essential items for{' '}
                  {ACTIVITY_TYPES.find((t) => t.value === selectedActivity)?.label.toLowerCase()}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
