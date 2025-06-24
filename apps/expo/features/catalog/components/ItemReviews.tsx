'use client';

import { useState } from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import { Icon } from '@roninoss/icons';
import type { ItemReview } from 'expo-app/types';
import { Text } from 'nativewindui/Text';
import { useColorScheme } from 'expo-app/lib/useColorScheme';

type ItemReviewsProps = {
  reviews: ItemReview[];
};

export function ItemReviews({ reviews }: ItemReviewsProps) {
  const [expandedReviews, setExpandedReviews] = useState<Record<string, boolean>>({});
  const { colors } = useColorScheme();

  if (!reviews || reviews.length === 0) return null;

  const toggleReviewExpansion = (reviewId: string) => {
    setExpandedReviews((prev) => ({
      ...prev,
      [reviewId]: !prev[reviewId],
    }));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <View className="mb-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text variant="callout">Reviews</Text>
        <Text className="text-sm text-muted-foreground">{reviews.length} reviews</Text>
      </View>

      {reviews.map((review) => {
        const isExpanded = expandedReviews[review.id] || false;
        const shouldTruncate = review.text.length > 150;

        return (
          <View key={review.id} className="mb-3 rounded-lg bg-card p-3 shadow-sm">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                {review.userAvatar ? (
                  <Image source={{ uri: review.userAvatar }} className="h-8 w-8 rounded-full" />
                ) : (
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <Icon name="person-outline" size={16} color="text-muted-foreground" />
                  </View>
                )}
                <View className="ml-2">
                  <Text className="font-medium text-foreground">{review.userName}</Text>
                  <Text className="text-xs text-muted-foreground">{formatDate(review.date)}</Text>
                </View>
              </View>
              <View className="flex-row items-center">
                {review.verified && (
                  <View className="mr-2 flex-row items-center">
                    <Icon name="check-circle-outline" size={14} color={colors.green} />
                    <Text className="ml-1 text-xs text-green-900 dark:text-green-500">
                      Verified
                    </Text>
                  </View>
                )}
                <View className="flex-row items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Icon
                      key={star}
                      name={star <= review.rating ? 'star' : 'star-outline'}
                      size={14}
                      color={colors.yellow}
                    />
                  ))}
                </View>
              </View>
            </View>

            <View className="mt-2">
              <Text
                className="text-foreground"
                numberOfLines={shouldTruncate && !isExpanded ? 3 : undefined}
              >
                {review.text}
              </Text>

              {shouldTruncate && (
                <TouchableOpacity className="mt-1" onPress={() => toggleReviewExpansion(review.id)}>
                  <Text className="text-sm text-primary">
                    {isExpanded ? 'Show less' : 'Read more'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {review.helpful !== undefined && (
              <View className="mt-2 flex-row items-center">
                <Icon name="heart" size={14} color={colors.grey} />
                <Text className="ml-1 text-xs text-muted-foreground">
                  {review.helpful} {review.helpful === 1 ? 'person' : 'people'} found this helpful
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
