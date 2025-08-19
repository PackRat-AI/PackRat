import { Button, Text } from '@packrat/ui/nativewindui';
import { Icon, type MaterialIconName } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Alert, Pressable, ScrollView, View } from 'react-native';

interface ToolInfo {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  category: string;
  example: string;
}

interface AvailableToolsGenerativeUIProps {
  tools: ToolInfo[];
  totalCount: number;
}

const getCategoryColor = (category: string): string => {
  const categoryColors: Record<string, string> = {
    Packs: '#3B82F6', // blue
    Items: '#10B981', // green
    Weather: '#06B6D4', // cyan
    Catalog: '#8B5CF6', // purple
    Guides: '#F59E0B', // amber
    Search: '#EF4444', // red
    Advanced: '#6B7280', // gray
  };
  return categoryColors[category] || '#6B7280';
};

const getIconName = (iconStr: string): MaterialIconName => {
  const iconMap: Record<string, MaterialIconName> = {
    backpack: 'backpack',
    archive: 'archive',
    cloud: 'cloud',
    'clipboard-list': 'clipboard-list',
    magnify: 'magnify',
    'book-open': 'book-open',
    web: 'web',
    database: 'database',
  };
  return iconMap[iconStr] || 'tool';
};

const handleToolPress = (tool: ToolInfo) => {
  Alert.alert(
    tool.displayName,
    `${tool.description}\n\nExample: "${tool.example}"\n\nCategory: ${tool.category}`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Try Example',
        onPress: () => {
          Alert.alert(
            'Example Usage',
            `Try asking: "${tool.example}"`,
            [{ text: 'Got it!', style: 'default' }]
          );
        },
      },
    ]
  );
};

export function AvailableToolsGenerativeUI({ tools, totalCount }: AvailableToolsGenerativeUIProps) {
  const { colors } = useColorScheme();

  // Group tools by category
  const toolsByCategory = tools.reduce((acc, tool) => {
    if (!acc[tool.category]) {
      acc[tool.category] = [];
    }
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, ToolInfo[]>);

  const categories = Object.keys(toolsByCategory).sort();

  return (
    <View className="my-2 overflow-hidden rounded-2xl border border-border bg-card">
      {/* Header */}
      <View className="bg-muted/30 border-b border-border px-4 py-3">
        <View className="flex-row items-center gap-2">
          <Icon name="tool" size={16} color={colors.foreground} />
          <Text className="text-sm text-foreground" color="secondary">
            Available AI Tools
          </Text>
        </View>
        <Text className="text-xs text-muted-foreground mt-1">
          {totalCount} tools available to help you manage your outdoor gear and adventures
        </Text>
      </View>

      {/* Tools List */}
      <ScrollView 
        className="max-h-96" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 12 }}
      >
        {categories.map((category) => (
          <View key={category} className="px-4 py-2">
            {/* Category Header */}
            <View className="flex-row items-center gap-2 mb-3 mt-2">
              <View 
                className="rounded-full px-2 py-1"
                style={{ backgroundColor: `${getCategoryColor(category)}20` }}
              >
                <Text 
                  className="text-xs font-semibold"
                  style={{ color: getCategoryColor(category) }}
                >
                  {category}
                </Text>
              </View>
            </View>

            {/* Tools in Category */}
            <View className="gap-2">
              {toolsByCategory[category].map((tool) => (
                <Pressable
                  key={tool.name}
                  onPress={() => handleToolPress(tool)}
                  className="rounded-xl border border-border bg-background p-3 active:opacity-70"
                >
                  <View className="flex-row items-center gap-3">
                    <View
                      className="h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${getCategoryColor(tool.category)}20` }}
                    >
                      <Icon
                        name={getIconName(tool.icon)}
                        size={18}
                        color={getCategoryColor(tool.category)}
                      />
                    </View>

                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-foreground">
                        {tool.displayName}
                      </Text>
                      <Text className="text-xs text-muted-foreground mt-1" numberOfLines={2}>
                        {tool.description}
                      </Text>
                    </View>

                    <Icon name="chevron-right" size={16} color={colors.muted} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* Footer */}
        <View className="px-4 pt-2 pb-2">
          <View className="rounded-lg bg-muted/20 p-3">
            <Text className="text-xs text-muted-foreground text-center">
              💡 Tip: Tap any tool to see an example of how to use it, or just ask me in natural language!
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}