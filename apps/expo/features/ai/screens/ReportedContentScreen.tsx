'use client';

import { Button, LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useState } from 'react';
import { ActivityIndicator, FlatList, TouchableOpacity, View } from 'react-native';
import { useReportedContent } from '../hooks/useReportedContent';
import { useUpdateReportStatus } from '../hooks/useUpdateReportStatus';
import { reportReasonLabels } from '../lib/reportReasons';

export default function ReportedContentScreen() {
  const { colors } = useColorScheme();
  const [selectedFilter, setSelectedFilter] = useState<
    'all' | 'pending' | 'reviewed' | 'dismissed'
  >('pending');

  const { data, isLoading, error } = useReportedContent();
  const updateMutation = useUpdateReportStatus();

  const filteredData = data?.filter((item) => {
    if (selectedFilter === 'all') return true;
    return item.status === selectedFilter;
  });

  const handleReview = (id: string, status: 'reviewed' | 'dismissed') => {
    updateMutation.mutate({ id, status });
  };

  return (
    <View className="flex-1 bg-background">
      <LargeTitleHeader title="Reported Content" />

      <View className="flex-row justify-around px-4 py-2">
        <FilterButton
          label="Pending"
          isActive={selectedFilter === 'pending'}
          onPress={() => setSelectedFilter('pending')}
        />
        <FilterButton
          label="Reviewed"
          isActive={selectedFilter === 'reviewed'}
          onPress={() => setSelectedFilter('reviewed')}
        />
        <FilterButton
          label="Dismissed"
          isActive={selectedFilter === 'dismissed'}
          onPress={() => setSelectedFilter('dismissed')}
        />
        <FilterButton
          label="All"
          isActive={selectedFilter === 'all'}
          onPress={() => setSelectedFilter('all')}
        />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-center text-destructive">Error loading reported content</Text>
        </View>
      ) : filteredData?.length === 0 ? (
        <View className="flex-1 items-center justify-center p-4">
          <Icon name="magnify" size={48} color={colors.grey2} />
          <Text className="mt-4 text-center text-muted-foreground">No reported content found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.id.toString()}
          contentContainerClassName="p-4"
          renderItem={({ item }) => (
            <View className="mb-4 rounded-lg border border-border bg-card p-4">
              <View className="mb-2 flex-row justify-between">
                <Text className="font-medium">{item.user.firstName}</Text>
                <Text className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>

              {/* Report reason badge */}
              <View className="mb-3 flex-row">
                <View className="rounded-full bg-amber-100 px-2 py-1 dark:bg-amber-900">
                  <Text className="text-xs font-medium text-amber-800 dark:text-amber-100">
                    {reportReasonLabels[item.reason as keyof typeof reportReasonLabels] ||
                      item.reason}
                  </Text>
                </View>
              </View>

              {/* User Query Section */}
              <View className="my-2">
                <Text className="mb-1 text-xs font-medium text-muted-foreground">USER QUERY:</Text>
                <View className="rounded-md bg-blue-50 p-3 dark:bg-blue-950">
                  <Text className="text-blue-900 dark:text-blue-100">{item.userQuery}</Text>
                </View>
              </View>

              {/* AI Response Section */}
              <View className="my-2">
                <Text className="mb-1 text-xs font-medium text-muted-foreground">AI RESPONSE:</Text>
                <View className="rounded-md bg-red-50 p-3 dark:bg-red-950">
                  <Text className="text-red-900 dark:text-red-100">{item.aiResponse}</Text>
                </View>
              </View>

              {/* User Comment Section - only show if there is a comment */}
              {item.userComment && (
                <View className="my-2">
                  <Text className="mb-1 text-xs font-medium text-muted-foreground">
                    USER COMMENT:
                  </Text>
                  <View className="rounded-md bg-gray-50 p-3 dark:bg-gray-800">
                    <Text className="italic text-gray-700 dark:text-gray-300">
                      {item.userComment}
                    </Text>
                  </View>
                </View>
              )}

              {item.status === 'pending' ? (
                <View className="mt-3 flex-row justify-end gap-2">
                  <Button
                    variant="tonal"
                    size="sm"
                    onPress={() => handleReview(item.id, 'dismissed')}
                    disabled={updateMutation.isPending}
                  >
                    <Text>Dismiss</Text>
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onPress={() => handleReview(item.id, 'reviewed')}
                    disabled={updateMutation.isPending}
                  >
                    <Text>Resolve</Text>
                  </Button>
                </View>
              ) : (
                <View className="mt-3 flex-row justify-end">
                  <Text
                    className={cn(
                      'text-xs font-medium',
                      item.status === 'resolved' ? 'text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {item.status === 'resolved' ? 'Resolved' : 'Dismissed'}
                  </Text>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

function FilterButton({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={cn('rounded-full px-4 py-1', isActive ? 'bg-primary' : 'bg-muted')}
    >
      <Text
        className={cn(
          'text-sm font-medium',
          isActive ? 'text-primary-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
