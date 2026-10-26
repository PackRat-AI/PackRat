import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { pendingReview$, pendingShare$, type ShareContent } from '../lib/share';
import type { YearInReview } from '../utils/yearInReview';
import { SHARE_PALETTE } from './ShareCard';

/** Opens the share screen for a card. */
export function useShareCard() {
  const router = useRouter();
  return (content: ShareContent) => {
    pendingShare$.set(content);
    router.push('/trip-stats/share');
  };
}

/** Opens the year in review. */
export function useOpenReview() {
  const router = useRouter();
  return (review: YearInReview) => {
    pendingReview$.set(review);
    router.push('/trip-stats/year-in-review');
  };
}

/**
 * The share action on a stats card header: Material's standard icon button with Android's share
 * glyph, 48dp touch target.
 */
export function ShareIconButton({ onPress, testID }: { onPress: () => void; testID: string }) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      className="-my-2 -mr-2 p-3"
      accessibilityRole="button"
      accessibilityLabel={t('tripStats.share.action')}
      android_ripple={{ borderless: true, color: colors.grey5 }}
      testID={testID}
    >
      <Icon name="share-variant" size={22} color={colors.grey} />
    </Pressable>
  );
}

/** "Your 2026 in Review" at the top of Trip Stats, while the review is on offer. */
export function YearInReviewBanner({
  review,
  onPress,
}: {
  review: YearInReview;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
      className="overflow-hidden rounded-xl"
      testID={testIds.tripStats.reviewBanner}
    >
      <LinearGradient
        colors={[SHARE_PALETTE.top, SHARE_PALETTE.bottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <View className="flex-row items-center gap-4 p-4">
        <View
          className="h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
        >
          <Icon name="creation" size={26} color={SHARE_PALETTE.mint} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="heading" className="font-medium" style={{ color: '#FFFFFF' }}>
            {t('tripStats.review.bannerTitle', { year: review.year })}
          </Text>
          <Text variant="subhead" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {t('tripStats.review.bannerBody', {
              trips: t('tripStats.countTrips', { count: review.totals.trips }),
              nights: t('tripStats.countNights', { count: review.totals.nights }),
            })}
          </Text>
        </View>
        <Icon name="chevron-right" size={24} color="rgba(255,255,255,0.6)" />
      </View>
    </Pressable>
  );
}
