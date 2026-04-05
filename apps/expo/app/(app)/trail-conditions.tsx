import { LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { Icon, type MaterialIconName } from '@roninoss/icons';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type SurfaceCondition = 'Dry' | 'Muddy' | 'Snow' | 'Ice' | 'Closed';
type ObstacleLevel = 'None' | 'Minor' | 'Major';
type WaterCrossingStatus = 'Easy' | 'Moderate' | 'Difficult' | 'Flooded' | 'N/A';
type FireDangerLevel = 'Low' | 'Moderate' | 'High' | 'Extreme';
type BugActivityLevel = 'Low' | 'Moderate' | 'High';

interface TrailReport {
  user: string;
  date: string;
  text: string;
  timestamp: string;
}

interface TrailConditionData {
  id: string;
  section: string;
  state: string;
  lastUpdated: string;
  surface: SurfaceCondition;
  obstacles: ObstacleLevel;
  waterCrossings: WaterCrossingStatus;
  fireDanger: FireDangerLevel;
  bugActivity: BugActivityLevel;
  vegetationOvergrowth: boolean;
  parkingAvailable: boolean;
  facilitiesOpen: boolean;
  details: string;
  reports: TrailReport[];
}

const TRAIL_CONDITIONS: TrailConditionData[] = [
  {
    id: '1',
    section: 'Springer Mountain to Neels Gap',
    state: 'GA',
    lastUpdated: '2 days ago',
    surface: 'Muddy',
    obstacles: 'Minor',
    waterCrossings: 'Easy',
    fireDanger: 'Low',
    bugActivity: 'Moderate',
    vegetationOvergrowth: false,
    parkingAvailable: true,
    facilitiesOpen: true,
    details:
      'Trail is well maintained with clear blazes. Some muddy sections after recent rain but passable. Water sources are flowing well.',
    reports: [
      {
        user: 'HikerJohn',
        date: 'May 10',
        timestamp: '2024-05-10T08:30:00Z',
        text: 'Trail in great shape. Saw some trail maintenance crews working near Blood Mountain.',
      },
      {
        user: 'MountainGoat',
        date: 'May 8',
        timestamp: '2024-05-08T14:15:00Z',
        text: 'Muddy near stream crossings but otherwise good. All water sources flowing.',
      },
    ],
  },
  {
    id: '2',
    section: 'Neels Gap to Unicoi Gap',
    state: 'GA',
    lastUpdated: '5 days ago',
    surface: 'Dry',
    obstacles: 'Major',
    waterCrossings: 'Moderate',
    fireDanger: 'Moderate',
    bugActivity: 'High',
    vegetationOvergrowth: true,
    parkingAvailable: true,
    facilitiesOpen: false,
    details:
      'Some blowdowns reported between Low Gap and Blue Mountain shelters. Rocky sections can be slippery when wet. Moderate difficulty.',
    reports: [
      {
        user: 'TrailAngel22',
        date: 'May 7',
        timestamp: '2024-05-07T10:00:00Z',
        text: 'Three large trees down about 2 miles north of Low Gap shelter. Passable but difficult.',
      },
      {
        user: 'ThruHiker2024',
        date: 'May 5',
        timestamp: '2024-05-05T16:45:00Z',
        text: 'Rocky sections are challenging in rain. Trekking poles recommended.',
      },
    ],
  },
  {
    id: '3',
    section: 'Unicoi Gap to Tray Mountain',
    state: 'GA',
    lastUpdated: '1 week ago',
    surface: 'Dry',
    obstacles: 'None',
    waterCrossings: 'Easy',
    fireDanger: 'Low',
    bugActivity: 'Low',
    vegetationOvergrowth: false,
    parkingAvailable: true,
    facilitiesOpen: true,
    details:
      'Recently maintained trail with clear path and blazes. Some steep sections but well-graded. All water sources reliable.',
    reports: [
      {
        user: 'MountainLover',
        date: 'May 4',
        timestamp: '2024-05-04T09:20:00Z',
        text: 'Trail is in excellent condition. Views from Rocky Mountain are spectacular!',
      },
      {
        user: 'GearTester',
        date: 'May 2',
        timestamp: '2024-05-02T12:00:00Z',
        text: 'Easy to follow trail with good camping spots near Tray Mountain shelter.',
      },
    ],
  },
  {
    id: '4',
    section: "Tray Mountain to Dick's Creek Gap",
    state: 'GA',
    lastUpdated: '10 days ago',
    surface: 'Muddy',
    obstacles: 'Major',
    waterCrossings: 'Difficult',
    fireDanger: 'Low',
    bugActivity: 'Moderate',
    vegetationOvergrowth: true,
    parkingAvailable: false,
    facilitiesOpen: false,
    details:
      'Multiple blowdowns and washouts reported after recent storms. Some trail reroutes in effect. Check with local rangers for updates.',
    reports: [
      {
        user: 'SectionHiker',
        date: 'April 30',
        timestamp: '2024-04-30T07:50:00Z',
        text: 'Difficult hiking with many obstacles. Several trees down across trail.',
      },
      {
        user: 'TrailRunner',
        date: 'April 28',
        timestamp: '2024-04-28T15:30:00Z',
        text: 'Trail badly eroded in places. Slow going and requires careful navigation.',
      },
    ],
  },
  {
    id: '5',
    section: 'Mt. Washington Summit Trail',
    state: 'NH',
    lastUpdated: '1 day ago',
    surface: 'Ice',
    obstacles: 'Minor',
    waterCrossings: 'N/A',
    fireDanger: 'Low',
    bugActivity: 'Low',
    vegetationOvergrowth: false,
    parkingAvailable: true,
    facilitiesOpen: true,
    details:
      'Icy conditions above treeline. Microspikes or crampons required. Summit facilities open but dress in layers — high winds expected.',
    reports: [
      {
        user: 'AlpineClimber',
        date: 'May 11',
        timestamp: '2024-05-11T06:15:00Z',
        text: 'Solid ice above 5,000 ft. Used crampons from Lion Head trail junction to summit.',
      },
    ],
  },
  {
    id: '6',
    section: 'Glacier National Park — Highline Trail',
    state: 'MT',
    lastUpdated: '3 days ago',
    surface: 'Snow',
    obstacles: 'Major',
    waterCrossings: 'Flooded',
    fireDanger: 'Low',
    bugActivity: 'Low',
    vegetationOvergrowth: false,
    parkingAvailable: true,
    facilitiesOpen: false,
    details:
      'Significant snowpack remains on upper sections. Several creek crossings are running very high. Trail is officially closed past the Garden Wall junction.',
    reports: [
      {
        user: 'ParkRanger_GNP',
        date: 'May 9',
        timestamp: '2024-05-09T08:00:00Z',
        text: 'Official closure in effect past mile 4. Please respect closure signs for safety.',
      },
      {
        user: 'SnowHiker99',
        date: 'May 8',
        timestamp: '2024-05-08T11:30:00Z',
        text: 'Knee-deep snow drifts starting around mile 2. Bear Creek crossing is chest-deep and dangerous.',
      },
    ],
  },
];

const SURFACE_FILTERS: Array<{ label: string; value: SurfaceCondition | 'All' }> = [
  { label: 'All', value: 'All' },
  { label: 'Dry', value: 'Dry' },
  { label: 'Muddy', value: 'Muddy' },
  { label: 'Snow', value: 'Snow' },
  { label: 'Ice', value: 'Ice' },
  { label: 'Closed', value: 'Closed' },
];

const SURFACE_OPTIONS: SurfaceCondition[] = ['Dry', 'Muddy', 'Snow', 'Ice', 'Closed'];

function getSurfaceBadgeColor(surface: SurfaceCondition) {
  switch (surface) {
    case 'Dry':
      return 'bg-green-500';
    case 'Muddy':
      return 'bg-amber-600';
    case 'Snow':
      return 'bg-blue-400';
    case 'Ice':
      return 'bg-cyan-500';
    case 'Closed':
      return 'bg-red-600';
    default:
      return 'bg-gray-500';
  }
}

function SurfaceBadge({ surface }: { surface: SurfaceCondition }) {
  return (
    <View className={cn('rounded-full px-2 py-1', getSurfaceBadgeColor(surface))}>
      <Text variant="caption2" className="font-medium text-white">
        {surface}
      </Text>
    </View>
  );
}

function ConditionRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: MaterialIconName;
  label: string;
  value: string;
  valueColor?: string;
}) {
  const { colors } = useColorScheme();
  return (
    <View className="mb-1.5 flex-row items-center">
      <Icon name={icon} size={14} color={colors.grey} />
      <Text variant="footnote" className="mx-1.5 flex-1 text-muted-foreground">
        {label}
      </Text>
      <Text variant="footnote" className={cn('font-medium', valueColor ?? 'text-foreground')}>
        {value}
      </Text>
    </View>
  );
}

function StatusDot({ active, label }: { active: boolean; label: string }) {
  return (
    <View className="mr-3 flex-row items-center">
      <View className={cn('mr-1 h-2 w-2 rounded-full', active ? 'bg-green-500' : 'bg-red-500')} />
      <Text variant="caption1" className="text-muted-foreground">
        {label}
      </Text>
    </View>
  );
}

function TrailConditionCard({ trail }: { trail: TrailConditionData }) {
  const [expanded, setExpanded] = useState(false);
  const { colors } = useColorScheme();
  const { t } = useTranslation();

  return (
    <View className="mx-4 mb-3 overflow-hidden rounded-xl bg-card shadow-sm">
      <Pressable onPress={() => setExpanded((prev) => !prev)}>
        <View className="border-b border-border p-4">
          <View className="flex-row items-start justify-between">
            <Text variant="heading" className="mr-2 flex-1 font-semibold">
              {trail.section}
            </Text>
            <SurfaceBadge surface={trail.surface} />
          </View>
          <Text variant="subhead" className="mt-1 text-muted-foreground">
            {trail.state} • {t('trailConditions.updated')} {trail.lastUpdated}
          </Text>
        </View>

        <View className="p-4">
          <Text variant="body" className="mb-3">
            {trail.details}
          </Text>

          <View className="mb-2 flex-row flex-wrap">
            <StatusDot active={trail.parkingAvailable} label={t('trailConditions.parking')} />
            <StatusDot active={trail.facilitiesOpen} label={t('trailConditions.facilities')} />
          </View>

          <View className="mt-1 rounded-lg bg-muted p-3 dark:bg-gray-50/10">
            <ConditionRow
              icon="tree-outline"
              label={t('trailConditions.obstacles')}
              value={trail.obstacles}
              valueColor={
                trail.obstacles === 'Major'
                  ? 'text-red-500'
                  : trail.obstacles === 'Minor'
                    ? 'text-amber-500'
                    : 'text-green-500'
              }
            />
            <ConditionRow
              icon="water"
              label={t('trailConditions.waterCrossings')}
              value={trail.waterCrossings}
              valueColor={
                trail.waterCrossings === 'Flooded' || trail.waterCrossings === 'Difficult'
                  ? 'text-red-500'
                  : trail.waterCrossings === 'Moderate'
                    ? 'text-amber-500'
                    : 'text-green-500'
              }
            />
            <ConditionRow
              icon="fire"
              label={t('trailConditions.fireDanger')}
              value={trail.fireDanger}
              valueColor={
                trail.fireDanger === 'Extreme' || trail.fireDanger === 'High'
                  ? 'text-red-500'
                  : trail.fireDanger === 'Moderate'
                    ? 'text-amber-500'
                    : 'text-green-500'
              }
            />
            <ConditionRow
              icon="bug"
              label={t('trailConditions.bugActivity')}
              value={trail.bugActivity}
              valueColor={
                trail.bugActivity === 'High'
                  ? 'text-red-500'
                  : trail.bugActivity === 'Moderate'
                    ? 'text-amber-500'
                    : 'text-green-500'
              }
            />
            {trail.vegetationOvergrowth && (
              <ConditionRow
                icon="leaf"
                label={t('trailConditions.vegetation')}
                value={t('trailConditions.overgrown')}
                valueColor="text-amber-500"
              />
            )}
          </View>

          <View className="mt-3 flex-row items-center justify-between">
            <Text variant="footnote" className="text-muted-foreground">
              {trail.reports.length} {t('trailConditions.reports')}
            </Text>
            <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.grey} />
          </View>
        </View>
      </Pressable>

      {expanded && (
        <View className="border-t border-border px-4 pb-4 pt-3">
          <Text variant="subhead" className="mb-2 font-medium">
            {t('trailConditions.conditionHistory')}
          </Text>
          {trail.reports.map((report) => (
            <View
              key={report.timestamp}
              className="mb-2 rounded-md bg-muted p-3 dark:bg-gray-50/10"
            >
              <View className="flex-row items-center justify-between">
                <Text variant="footnote" className="font-medium">
                  {report.user}
                </Text>
                <Text variant="caption1" className="text-muted-foreground">
                  {report.date}
                </Text>
              </View>
              <Text variant="footnote" className="mt-1">
                {report.text}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

interface ReportFormState {
  section: string;
  surface: SurfaceCondition;
  obstacles: ObstacleLevel;
  waterCrossings: WaterCrossingStatus;
  notes: string;
}

function OptionChips<T extends string>({
  options,
  selected,
  onSelect,
  getColor,
}: {
  options: T[];
  selected: T;
  onSelect: (val: T) => void;
  getColor?: (val: T) => string;
}) {
  return (
    <View className="mt-1 flex-row flex-wrap gap-2">
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          onPress={() => onSelect(opt)}
          className={cn(
            'rounded-full px-3 py-1.5',
            selected === opt
              ? getColor
                ? getColor(opt)
                : 'bg-primary'
              : 'bg-muted dark:bg-gray-50/10',
          )}
        >
          <Text
            variant="caption1"
            className={cn('font-medium', selected === opt ? 'text-white' : 'text-muted-foreground')}
          >
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ReportConditionModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, colorScheme } = useColorScheme();
  const { t } = useTranslation();

  const [form, setForm] = useState<ReportFormState>({
    section: '',
    surface: 'Dry',
    obstacles: 'None',
    waterCrossings: 'Easy',
    notes: '',
  });

  const handleSubmit = () => {
    if (!form.section.trim()) {
      Alert.alert(t('trailConditions.missingSection'), t('trailConditions.missingSectionMessage'));
      return;
    }
    Alert.alert(t('trailConditions.reportSubmitted'), t('trailConditions.reportSubmittedMessage'));
    setForm({ section: '', surface: 'Dry', obstacles: 'None', waterCrossings: 'Easy', notes: '' });
    onClose();
  };

  const inputClass = cn(
    'rounded-lg border border-border p-3 text-base',
    colorScheme === 'dark' ? 'bg-card text-white' : 'bg-white text-gray-900',
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View
          className="flex-1"
          style={{ backgroundColor: colorScheme === 'dark' ? colors.background : '#f2f2f7' }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-border px-4 pb-3 pt-5">
            <TouchableOpacity onPress={onClose}>
              <Text variant="body" className="text-primary">
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
            <Text variant="heading" className="font-semibold">
              {t('trailConditions.reportCondition')}
            </Text>
            <TouchableOpacity onPress={handleSubmit}>
              <Text variant="body" className="font-semibold text-primary">
                {t('common.submit')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
            {/* Trail Section */}
            <View className="mb-4">
              <Text variant="subhead" className="mb-1 font-medium text-muted-foreground">
                {t('trailConditions.trailSection').toUpperCase()}
              </Text>
              <TextInput
                value={form.section}
                onChangeText={(text) => setForm((prev) => ({ ...prev, section: text }))}
                placeholder={t('trailConditions.trailSectionPlaceholder')}
                placeholderTextColor={colors.grey}
                className={inputClass}
                style={{ color: colors.foreground }}
              />
            </View>

            {/* Surface Condition */}
            <View className="mb-4">
              <Text variant="subhead" className="mb-1 font-medium text-muted-foreground">
                {t('trailConditions.surfaceCondition').toUpperCase()}
              </Text>
              <OptionChips
                options={SURFACE_OPTIONS}
                selected={form.surface}
                onSelect={(val) => setForm((prev) => ({ ...prev, surface: val }))}
                getColor={getSurfaceBadgeColor}
              />
            </View>

            {/* Obstacles */}
            <View className="mb-4">
              <Text variant="subhead" className="mb-1 font-medium text-muted-foreground">
                {t('trailConditions.obstacles').toUpperCase()}
              </Text>
              <OptionChips<ObstacleLevel>
                options={['None', 'Minor', 'Major']}
                selected={form.obstacles}
                onSelect={(val) => setForm((prev) => ({ ...prev, obstacles: val }))}
              />
            </View>

            {/* Water Crossings */}
            <View className="mb-4">
              <Text variant="subhead" className="mb-1 font-medium text-muted-foreground">
                {t('trailConditions.waterCrossings').toUpperCase()}
              </Text>
              <OptionChips<WaterCrossingStatus>
                options={['Easy', 'Moderate', 'Difficult', 'Flooded', 'N/A']}
                selected={form.waterCrossings}
                onSelect={(val) => setForm((prev) => ({ ...prev, waterCrossings: val }))}
              />
            </View>

            {/* Notes */}
            <View className="mb-4">
              <Text variant="subhead" className="mb-1 font-medium text-muted-foreground">
                {t('trailConditions.additionalNotes').toUpperCase()}
              </Text>
              <TextInput
                value={form.notes}
                onChangeText={(text) => setForm((prev) => ({ ...prev, notes: text }))}
                placeholder={t('trailConditions.notesPlaceholder')}
                placeholderTextColor={colors.grey}
                multiline
                numberOfLines={4}
                className={inputClass}
                style={{ color: colors.foreground, minHeight: 100, textAlignVertical: 'top' }}
              />
            </View>

            {/* Add Photo (placeholder) */}
            <View className="mb-6">
              <Text variant="subhead" className="mb-1 font-medium text-muted-foreground">
                {t('trailConditions.photos').toUpperCase()}
              </Text>
              <TouchableOpacity
                className="flex-row items-center justify-center rounded-lg border border-dashed border-border bg-muted p-4 dark:bg-gray-50/10"
                onPress={() =>
                  Alert.alert(
                    t('trailConditions.comingSoon'),
                    t('trailConditions.photoUploadComingSoon'),
                  )
                }
              >
                <Icon name="camera-outline" size={20} color={colors.grey} />
                <Text variant="subhead" className="ml-2 text-muted-foreground">
                  {t('trailConditions.addPhoto')}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function TrailConditionsScreen() {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const [activeFilter, setActiveFilter] = useState<SurfaceCondition | 'All'>('All');
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const insets = useSafeAreaInsets();

  const filteredConditions =
    activeFilter === 'All'
      ? TRAIL_CONDITIONS
      : TRAIL_CONDITIONS.filter((trail) => trail.surface === activeFilter);

  return (
    <SafeAreaView style={{ flex: 1, paddingTop: insets.top }}>
      <LargeTitleHeader
        title={t('trailConditions.title')}
        rightView={() => (
          <TouchableOpacity
            onPress={() => setReportModalVisible(true)}
            className="flex-row items-center rounded-full bg-primary px-3 py-1.5"
          >
            <Icon name="plus" size={14} color="white" />
            <Text variant="caption1" className="ml-1 font-semibold text-white">
              {t('trailConditions.report')}
            </Text>
          </TouchableOpacity>
        )}
      />

      <ScrollView className="flex-1" stickyHeaderIndices={[0]} style={{ paddingTop: insets.top }}>
        {/* Filter bar — sticky */}
        <View className="border-b border-border bg-background px-4 pb-3 pt-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {SURFACE_FILTERS.map((filter) => (
                <TouchableOpacity
                  key={filter.value}
                  onPress={() => setActiveFilter(filter.value)}
                  className={cn(
                    'rounded-full px-3 py-1.5',
                    activeFilter === filter.value
                      ? filter.value === 'All'
                        ? 'bg-primary'
                        : getSurfaceBadgeColor(filter.value as SurfaceCondition)
                      : 'bg-muted dark:bg-gray-50/10',
                  )}
                >
                  <Text
                    variant="caption1"
                    className={cn(
                      'font-medium',
                      activeFilter === filter.value ? 'text-white' : 'text-muted-foreground',
                    )}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View className="p-4 pb-2">
          <Text variant="subhead" className="text-muted-foreground">
            {t('trailConditions.subtitle')}
          </Text>
        </View>

        <View className="pb-4">
          {filteredConditions.length === 0 ? (
            <View className="mx-4 mt-6 items-center rounded-xl bg-card p-8">
              <Icon name="map-search-outline" size={40} color={colors.grey} />
              <Text variant="subhead" className="mt-3 text-center text-muted-foreground">
                {t('trailConditions.noResults')}
              </Text>
            </View>
          ) : (
            filteredConditions.map((trail) => <TrailConditionCard key={trail.id} trail={trail} />)
          )}
        </View>

        <View className="mx-4 my-2 mb-6 rounded-lg bg-card p-4">
          <View className="rounded-md bg-muted p-3 dark:bg-gray-50/10">
            <Text variant="footnote" className="text-muted-foreground">
              {t('trailConditions.disclaimer')}
            </Text>
          </View>
        </View>
      </ScrollView>

      <ReportConditionModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
      />
    </SafeAreaView>
  );
}
