import { Icon } from '@roninoss/icons';
import { View, ScrollView } from 'react-native';
import { colors } from 'react-native-keyboard-controller/lib/typescript/components/KeyboardToolbar/colors';

import { LargeTitleHeader } from 'nativewindui/LargeTitleHeader';
import { Text } from 'nativewindui/Text';
import { useColorScheme } from '~/lib/useColorScheme';

// Mock data for pack templates
const PACK_TEMPLATES = [
  {
    id: '1',
    name: 'Ultralight 3-Season',
    description: 'Minimalist setup for fair weather hiking',
    itemCount: 32,
    totalWeight: '7.8 lbs',
    lastUsed: '2 weeks ago',
    tags: ['Ultralight', '3-Season', 'Solo'],
  },
  {
    id: '2',
    name: 'Winter Camping',
    description: 'Cold weather gear with extra insulation',
    itemCount: 45,
    totalWeight: '15.2 lbs',
    lastUsed: '3 months ago',
    tags: ['Winter', '4-Season', 'Cold Weather'],
  },
  {
    id: '3',
    name: 'Weekend Trip',
    description: 'Balanced setup for 2-3 day hikes',
    itemCount: 38,
    totalWeight: '10.5 lbs',
    lastUsed: '1 month ago',
    tags: ['Weekend', 'Lightweight', 'Versatile'],
  },
  {
    id: '4',
    name: 'Desert Hiking',
    description: 'Optimized for hot, dry conditions',
    itemCount: 35,
    totalWeight: '9.2 lbs',
    lastUsed: '6 months ago',
    tags: ['Desert', 'Hot Weather', 'Water Management'],
  },
];

function TemplateTags({ tags }: { tags: string[] }) {
  return (
    <View className="mt-2 flex-row flex-wrap">
      {tags.map((tag, index) => (
        <View key={tag} className="mb-1 mr-1 rounded-full bg-muted px-2 py-0.5 dark:bg-gray-50/10">
          <Text variant="caption2" className="text-muted-foreground">
            {tag}
          </Text>
        </View>
      ))}
    </View>
  );
}

function TemplateCard({ template }: { template: (typeof PACK_TEMPLATES)[0] }) {
  const { colors } = useColorScheme();

  return (
    <View className="mx-4 mb-3 overflow-hidden rounded-xl bg-card shadow-sm">
      <View className="p-4">
        <View className="flex-row items-start">
          <View className="mr-3 h-12 w-12 items-center justify-center rounded-md bg-primary">
            <Icon name="file-document-outline" size={24} color="white" />
          </View>

          <View className="flex-1">
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text variant="heading" className="font-semibold">
                  {template.name}
                </Text>
                <Text variant="footnote" className="text-muted-foreground">
                  {template.description}
                </Text>
              </View>
              <View className="items-end">
                <Text variant="subhead" className="font-medium">
                  {template.totalWeight}
                </Text>
                <Text variant="footnote" className="text-muted-foreground">
                  {template.itemCount} items
                </Text>
              </View>
            </View>

            <TemplateTags tags={template.tags} />

            <View className="mt-2 flex-row items-center gap-1">
              <Icon name="clock-outline" size={14} color={colors.grey} />
              <Text variant="caption1" className="text-muted-foreground">
                Last used: {template.lastUsed}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function PackTemplatesScreen() {
  return (
    <>
      <LargeTitleHeader title="Pack Templates" />
      <ScrollView className="flex-1">
        <View className="p-4">
          <Text variant="subhead" className="mb-2 text-muted-foreground">
            Reusable pack configurations for different scenarios
          </Text>
        </View>

        <View className="pb-4">
          {PACK_TEMPLATES.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </View>

        <View className="mx-4 my-2 mb-6 rounded-lg bg-card p-4">
          <Text variant="heading" className="mb-2 font-semibold">
            Template Usage
          </Text>
          <Text variant="body" className="mb-4">
            Templates allow you to quickly create new packs based on proven configurations. Use them
            as starting points and customize for specific trips.
          </Text>
          <View className="rounded-md bg-muted p-3 dark:bg-gray-50/10">
            <Text variant="subhead" className="font-medium">
              Pro Tip
            </Text>
            <Text variant="footnote" className="mt-1 text-muted-foreground">
              After a successful trip, save your pack as a template to reuse for similar adventures
              in the future.
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
