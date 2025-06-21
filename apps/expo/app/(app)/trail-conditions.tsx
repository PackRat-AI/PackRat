import { Icon } from '@roninoss/icons';
import { View, ScrollView } from 'react-native';

import { LargeTitleHeader } from 'nativewindui/LargeTitleHeader';
import { Text } from 'nativewindui/Text';
import { cn } from '~/lib/cn';

// Mock data for trail conditions
const TRAIL_CONDITIONS = [
  {
    id: '1',
    section: 'Springer Mountain to Neels Gap',
    state: 'GA',
    lastUpdated: '2 days ago',
    condition: 'Good',
    details:
      'Trail is well maintained with clear blazes. Some muddy sections after recent rain but passable. Water sources are flowing well.',
    reports: [
      {
        user: 'HikerJohn',
        date: 'May 10',
        text: 'Trail in great shape. Saw some trail maintenance crews working near Blood Mountain.',
      },
      {
        user: 'MountainGoat',
        date: 'May 8',
        text: 'Muddy near stream crossings but otherwise good. All water sources flowing.',
      },
    ],
  },
  {
    id: '2',
    section: 'Neels Gap to Unicoi Gap',
    state: 'GA',
    lastUpdated: '5 days ago',
    condition: 'Fair',
    details:
      'Some blowdowns reported between Low Gap and Blue Mountain shelters. Rocky sections can be slippery when wet. Moderate difficulty.',
    reports: [
      {
        user: 'TrailAngel22',
        date: 'May 7',
        text: 'Three large trees down about 2 miles north of Low Gap shelter. Passable but difficult.',
      },
      {
        user: 'ThruHiker2024',
        date: 'May 5',
        text: 'Rocky sections are challenging in rain. Trekking poles recommended.',
      },
    ],
  },
  {
    id: '3',
    section: 'Unicoi Gap to Tray Mountain',
    state: 'GA',
    lastUpdated: '1 week ago',
    condition: 'Excellent',
    details:
      'Recently maintained trail with clear path and blazes. Some steep sections but well-graded. All water sources reliable.',
    reports: [
      {
        user: 'MountainLover',
        date: 'May 4',
        text: 'Trail is in excellent condition. Views from Rocky Mountain are spectacular!',
      },
      {
        user: 'GearTester',
        date: 'May 2',
        text: 'Easy to follow trail with good camping spots near Tray Mountain shelter.',
      },
    ],
  },
  {
    id: '4',
    section: "Tray Mountain to Dick's Creek Gap",
    state: 'GA',
    lastUpdated: '10 days ago',
    condition: 'Poor',
    details:
      'Multiple blowdowns and washouts reported after recent storms. Some trail reroutes in effect. Check with local rangers for updates.',
    reports: [
      {
        user: 'SectionHiker',
        date: 'April 30',
        text: 'Difficult hiking with many obstacles. Several trees down across trail.',
      },
      {
        user: 'TrailRunner',
        date: 'April 28',
        text: 'Trail badly eroded in places. Slow going and requires careful navigation.',
      },
    ],
  },
];

function ConditionBadge({ condition }: { condition: string }) {
  const getColor = () => {
    switch (condition) {
      case 'Excellent':
        return 'bg-green-500';
      case 'Good':
        return 'bg-blue-500';
      case 'Fair':
        return 'bg-amber-500';
      case 'Poor':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <View className={cn('rounded-full px-2 py-1', getColor())}>
      <Text variant="caption2" className="font-medium text-white">
        {condition}
      </Text>
    </View>
  );
}

function TrailConditionCard({ trail }: { trail: (typeof TRAIL_CONDITIONS)[0] }) {
  return (
    <View className="mx-4 mb-3 overflow-hidden rounded-xl bg-card shadow-sm">
      <View className="border-b border-border p-4">
        <View className="flex-row items-center justify-between">
          <Text variant="heading" className="flex-1 font-semibold">
            {trail.section}
          </Text>
          <ConditionBadge condition={trail.condition} />
        </View>
        <Text variant="subhead" className="mt-1 text-muted-foreground">
          {trail.state} • Updated {trail.lastUpdated}
        </Text>
      </View>

      <View className="p-4">
        <Text variant="body" className="mb-3">
          {trail.details}
        </Text>

        <View className="mt-2">
          <Text variant="subhead" className="mb-2 font-medium">
            Recent Reports:
          </Text>
          {trail.reports.map((report, index) => (
            <View key={index} className="mb-2 rounded-md bg-muted p-3 dark:bg-gray-50/10">
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
      </View>
    </View>
  );
}

export default function TrailConditionsScreen() {
  return (
    <>
      <LargeTitleHeader title="Trail Conditions" />
      <ScrollView className="flex-1">
        <View className="p-4">
          <Text variant="subhead" className="mb-2 text-muted-foreground">
            Current trail conditions from recent hiker reports
          </Text>
        </View>

        <View className="pb-4">
          {TRAIL_CONDITIONS.map((trail) => (
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
    </>
  );
}
