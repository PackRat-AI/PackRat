import { LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import type { TrailCondition, TrailConditionValue } from 'expo-app/features/trail-conditions';
import {
  useCreateTrailConditionReport,
  useTrailConditions,
} from 'expo-app/features/trail-conditions';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { nanoid } from 'nanoid/non-secure';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Mock data used as fallback when API is unavailable
const TRAIL_CONDITIONS_MOCK = [
  {
    id: '1',
    userId: 0,
    trailName: 'Springer Mountain to Neels Gap',
    location: { latitude: 34.627, longitude: -84.193, name: 'GA' },
    condition: 'good' as TrailConditionValue,
    details:
      'Trail is well maintained with clear blazes. Some muddy sections after recent rain but passable. Water sources are flowing well.',
    photos: [],
    trustScore: 0.85,
    verifiedCount: 4,
    helpfulCount: 12,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    userId: 0,
    trailName: 'Neels Gap to Unicoi Gap',
    location: { latitude: 34.738, longitude: -83.921, name: 'GA' },
    condition: 'fair' as TrailConditionValue,
    details:
      'Some blowdowns reported between Low Gap and Blue Mountain shelters. Rocky sections can be slippery when wet.',
    photos: [],
    trustScore: 0.7,
    verifiedCount: 2,
    helpfulCount: 7,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    userId: 0,
    trailName: 'Unicoi Gap to Tray Mountain',
    location: { latitude: 34.836, longitude: -83.743, name: 'GA' },
    condition: 'excellent' as TrailConditionValue,
    details:
      'Recently maintained trail with clear path and blazes. Some steep sections but well-graded. All water sources reliable.',
    photos: [],
    trustScore: 0.92,
    verifiedCount: 6,
    helpfulCount: 18,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    userId: 0,
    trailName: "Tray Mountain to Dick's Creek Gap",
    location: { latitude: 34.913, longitude: -83.598, name: 'GA' },
    condition: 'poor' as TrailConditionValue,
    details:
      'Multiple blowdowns and washouts reported after recent storms. Some trail reroutes in effect. Check with local rangers.',
    photos: [],
    trustScore: 0.6,
    verifiedCount: 1,
    helpfulCount: 5,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const CONDITION_LABELS: Record<TrailConditionValue, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  closed: 'Closed',
};

function getConditionColor(condition: TrailConditionValue): string {
  switch (condition) {
    case 'excellent':
      return 'bg-green-500';
    case 'good':
      return 'bg-blue-500';
    case 'fair':
      return 'bg-amber-500';
    case 'poor':
      return 'bg-red-500';
    case 'closed':
      return 'bg-gray-700';
    default:
      return 'bg-gray-500';
  }
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return '1 week ago';
  return `${Math.floor(days / 7)} weeks ago`;
}

function TrustScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.8 ? 'text-green-600' : score >= 0.6 ? 'text-amber-600' : 'text-red-600';
  return (
    <View className="flex-row items-center gap-1">
      <Icon
        name="shield-check"
        size={12}
        color={score >= 0.8 ? '#16a34a' : score >= 0.6 ? '#d97706' : '#dc2626'}
      />
      <Text variant="caption2" className={cn('font-medium', color)}>
        {pct}% trust
      </Text>
    </View>
  );
}

function ConditionBadge({ condition }: { condition: TrailConditionValue }) {
  return (
    <View className={cn('rounded-full px-2 py-1', getConditionColor(condition))}>
      <Text variant="caption2" className="font-medium text-white">
        {CONDITION_LABELS[condition]}
      </Text>
    </View>
  );
}

function TrailConditionCard({ trail }: { trail: TrailCondition }) {
  const locationLabel = trail.location?.name
    ? trail.location.name
    : trail.location
      ? `${trail.location.latitude.toFixed(3)}, ${trail.location.longitude.toFixed(3)}`
      : null;

  return (
    <View className="mx-4 mb-3 overflow-hidden rounded-xl bg-card shadow-sm">
      <View className="border-b border-border p-4">
        <View className="flex-row items-center justify-between">
          <Text variant="heading" className="flex-1 font-semibold">
            {trail.trailName}
          </Text>
          <ConditionBadge condition={trail.condition} />
        </View>
        <View className="mt-1 flex-row items-center gap-3">
          {locationLabel && (
            <Text variant="subhead" className="text-muted-foreground">
              {locationLabel}
            </Text>
          )}
          <Text variant="subhead" className="text-muted-foreground">
            • {formatRelativeTime(trail.updatedAt)}
          </Text>
        </View>
      </View>

      <View className="p-4">
        <Text variant="body" className="mb-3">
          {trail.details}
        </Text>

        <View className="flex-row items-center justify-between">
          <TrustScoreBadge score={trail.trustScore} />
          <View className="flex-row items-center gap-3">
            {trail.verifiedCount > 0 && (
              <Text variant="caption2" className="text-muted-foreground">
                {trail.verifiedCount} verified
              </Text>
            )}
            {trail.helpfulCount > 0 && (
              <Text variant="caption2" className="text-muted-foreground">
                {trail.helpfulCount} helpful
              </Text>
            )}
          </View>
        </View>

        {trail.location && (
          <View className="mt-2 flex-row items-center gap-1">
            <Icon name="map-marker" size={12} color="#6b7280" />
            <Text variant="caption2" className="text-muted-foreground">
              {trail.location.latitude.toFixed(4)}, {trail.location.longitude.toFixed(4)}
            </Text>
          </View>
        )}

        {Array.isArray(trail.photos) && trail.photos.length > 0 && (
          <View className="mt-2 flex-row items-center gap-1">
            <Icon name="image-multiple" size={12} color="#6b7280" />
            <Text variant="caption2" className="text-muted-foreground">
              {trail.photos.length} photo{trail.photos.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const CONDITION_OPTIONS: { value: TrailConditionValue; label: string }[] = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'closed', label: 'Closed' },
];

function ReportModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useColorScheme();
  const createReport = useCreateTrailConditionReport();

  const [trailName, setTrailName] = useState('');
  const [condition, setCondition] = useState<TrailConditionValue>('good');
  const [details, setDetails] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');

  const handleSubmit = async () => {
    if (!trailName.trim()) {
      Alert.alert('Required', 'Please enter a trail name.');
      return;
    }
    if (!details.trim()) {
      Alert.alert('Required', 'Please enter condition details.');
      return;
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const hasValidCoords =
      lat.trim() && lng.trim() && !Number.isNaN(parsedLat) && !Number.isNaN(parsedLng);

    if ((lat.trim() || lng.trim()) && !hasValidCoords) {
      Alert.alert('Invalid GPS', 'Please enter valid numeric latitude and longitude values.');
      return;
    }

    const location = hasValidCoords ? { latitude: parsedLat, longitude: parsedLng } : undefined;

    try {
      await createReport.mutateAsync({
        id: `tc_${nanoid()}`,
        trailName: trailName.trim(),
        condition,
        details: details.trim(),
        location,
        photos: [],
      });
      setTrailName('');
      setCondition('good');
      setDetails('');
      setLat('');
      setLng('');
      onClose();
      Alert.alert('Success', 'Your trail condition report has been submitted.');
    } catch {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-background">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-4">
          <TouchableOpacity onPress={onClose}>
            <Text variant="body" className="text-primary">
              Cancel
            </Text>
          </TouchableOpacity>
          <Text variant="heading" className="font-semibold">
            Report Condition
          </Text>
          <TouchableOpacity onPress={handleSubmit} disabled={createReport.isPending}>
            {createReport.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text variant="body" className="font-semibold text-primary">
                Submit
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 p-4">
          <View className="mb-4">
            <Text variant="subhead" className="mb-1 font-medium">
              Trail Name *
            </Text>
            <TextInput
              className="rounded-lg border border-border bg-card px-3 py-3 text-foreground"
              placeholder="e.g. Springer Mountain to Neels Gap"
              placeholderTextColor={colors.grey2}
              value={trailName}
              onChangeText={setTrailName}
            />
          </View>

          <View className="mb-4">
            <Text variant="subhead" className="mb-2 font-medium">
              Condition *
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {CONDITION_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setCondition(opt.value)}
                  className={cn(
                    'rounded-full px-3 py-2',
                    condition === opt.value
                      ? getConditionColor(opt.value)
                      : 'border border-border bg-card',
                  )}
                >
                  <Text
                    variant="footnote"
                    className={cn(
                      'font-medium',
                      condition === opt.value ? 'text-white' : 'text-foreground',
                    )}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="mb-4">
            <Text variant="subhead" className="mb-1 font-medium">
              Details *
            </Text>
            <TextInput
              className="rounded-lg border border-border bg-card px-3 py-3 text-foreground"
              placeholder="Describe current trail conditions..."
              placeholderTextColor={colors.grey2}
              value={details}
              onChangeText={setDetails}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={{ minHeight: 100 }}
            />
          </View>

          <View className="mb-4">
            <Text variant="subhead" className="mb-1 font-medium">
              GPS Location (optional)
            </Text>
            <View className="flex-row gap-2">
              <TextInput
                className="flex-1 rounded-lg border border-border bg-card px-3 py-3 text-foreground"
                placeholder="Latitude"
                placeholderTextColor={colors.grey2}
                value={lat}
                onChangeText={setLat}
                keyboardType="decimal-pad"
              />
              <TextInput
                className="flex-1 rounded-lg border border-border bg-card px-3 py-3 text-foreground"
                placeholder="Longitude"
                placeholderTextColor={colors.grey2}
                value={lng}
                onChangeText={setLng}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View className="mb-4 rounded-lg bg-muted p-3">
            <View className="flex-row items-center gap-2">
              <Icon name="shield-check" size={16} color="#6b7280" />
              <Text variant="footnote" className="font-medium text-muted-foreground">
                Trust Scoring
              </Text>
            </View>
            <Text variant="caption1" className="mt-1 text-muted-foreground">
              Your report's trust score is based on your reporting history. More verified reports
              increase your trust level.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function TrailConditionsScreen() {
  const { data, isLoading, isError } = useTrailConditions();
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const { colors } = useColorScheme();

  // Use API data if available, fall back to mock data
  const trails: TrailCondition[] = data && data.length > 0 ? data : TRAIL_CONDITIONS_MOCK;

  return (
    <>
      <LargeTitleHeader title="Trail Conditions" />
      <ScrollView className="flex-1">
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Text variant="subhead" className="flex-1 text-muted-foreground">
            Current trail conditions from recent hiker reports
          </Text>
          <Pressable
            onPress={() => setReportModalVisible(true)}
            className="flex-row items-center gap-1 rounded-lg bg-primary px-3 py-2"
          >
            <Icon name="plus" size={14} color="white" />
            <Text variant="footnote" className="font-semibold text-white">
              Report
            </Text>
          </Pressable>
        </View>

        {isLoading && (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text variant="footnote" className="mt-2 text-muted-foreground">
              Loading trail conditions...
            </Text>
          </View>
        )}

        {isError && (
          <View className="mx-4 mb-3 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
            <Text variant="footnote" className="text-amber-700 dark:text-amber-400">
              Could not load latest conditions. Showing cached data.
            </Text>
          </View>
        )}

        <View className="pb-4">
          {trails.map((trail) => (
            <TrailConditionCard key={trail.id} trail={trail} />
          ))}
        </View>

        <View className="mx-4 my-2 mb-6 rounded-lg bg-card p-4">
          <View className="rounded-md bg-muted p-3 dark:bg-gray-50/10">
            <Text variant="footnote" className="text-muted-foreground">
              Trail conditions are crowdsourced from hikers and may not reflect current situations.
              Always check with local authorities for official trail status.
            </Text>
          </View>
        </View>
      </ScrollView>

      <ReportModal visible={reportModalVisible} onClose={() => setReportModalVisible(false)} />
    </>
  );
}
