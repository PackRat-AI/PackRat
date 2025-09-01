import EvilIcons from '@expo/vector-icons/EvilIcons';
import Fontisto from '@expo/vector-icons/Fontisto';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  Card,
  CardContent,
  Sheet,
  Text,
  useColorScheme,
  useSheetRef,
} from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { Linking, Pressable, View } from 'react-native';
import type { ToolInvocation } from '../types';
import { ToolCard } from './ToolCard';

type WebSearchToolInput = {
  query: string;
};

type WebSearchToolOutput =
  | {
      data: {
        query: string;
        answer: string;
        sources: Array<{
          type: string;
          sourceType: string;
          id: string;
          url: string;
        }>;
      };
      success: true;
    }
  | {
      success: false;
      error: string;
    };

export type WebSearchTool = {
  type: 'tool-webSearchTool';
} & ToolInvocation<WebSearchToolInput, WebSearchToolOutput>;

interface WebSearchGenerativeUIProps {
  toolInvocation: WebSearchTool;
}

export function WebSearchGenerativeUI({ toolInvocation }: WebSearchGenerativeUIProps) {
  const bottomSheetRef = useSheetRef();
  const { colors } = useColorScheme();

  const handleCardPress = () => {
    bottomSheetRef.current?.present();
  };

  const handleSourcePress = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  const formatDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  switch (toolInvocation.state) {
    case 'input-streaming':
      return <ToolCard text="Initiating web search..." icon="loading" />;
    case 'input-available':
      return (
        <ToolCard
          text={`Searching the web for "${toolInvocation.input.query}"...`}
          icon="loading"
        />
      );
    case 'output-available':
      return toolInvocation.output.success ? (
        <>
          <ToolCard
            text={`Searched for "${toolInvocation.input.query}"`}
            onPress={handleCardPress}
            icon={<Fontisto name="world-o" size={16} color={colors.foreground} />}
          />
          <Sheet ref={bottomSheetRef} snapPoints={['85%']}>
            <BottomSheetScrollView className="flex-1 px-4" style={{ flex: 1 }}>
              <View>
                {/* Header */}
                <View className="mb-6">
                  <View className="flex-row items-center mb-3">
                    <Text variant="heading" className="text-center">
                      Searched for "{toolInvocation.input.query}"
                    </Text>
                  </View>
                </View>

                {/* Sources */}
                {toolInvocation.output.data.sources &&
                  toolInvocation.output.data.sources.length > 0 && (
                    <View className="mb-6">
                      <View className="flex-row items-center mb-3">
                        <Icon name="link" size={16} color={colors.green} />
                        <Text variant="caption1" className="uppercase tracking-wide">
                          Sources ({toolInvocation.output.data.sources.length})
                        </Text>
                      </View>
                      <View className="gap-3">
                        {toolInvocation.output.data.sources.map((source, index) => (
                          <Pressable
                            key={source.id || index}
                            onPress={() => handleSourcePress(source.url)}
                            className="bg-card border border-border rounded-xl p-4"
                          >
                            <View className="flex-row items-start justify-between">
                              <View className="flex-1 mr-3">
                                <Text className="text-sm font-medium text-muted-foreground mb-1">
                                  {formatDomain(source.url)}
                                </Text>
                                <Text
                                  className="text-base font-medium text-foreground"
                                  numberOfLines={2}
                                >
                                  {source.url}
                                </Text>
                              </View>
                              <EvilIcons
                                name="external-link"
                                color={colors.foreground}
                                size={16}
                                className="text-muted-foreground mt-1"
                              />
                            </View>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}

                {/* Bottom padding for safe area */}
                <View className="h-8" />
              </View>
            </BottomSheetScrollView>
          </Sheet>
        </>
      ) : (
        <ToolCard text="Couldn't search the web" icon="error" />
      );

    case 'output-error':
      return (
        <Card rootClassName="border border-border rounded-xl bg-inherit shadow-none">
          <CardContent className="flex-row items-center justify-between">
            <View className="flex-1 flex-row items-center gap-2 mr-3">
              <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
              <Text variant="caption2">Couldn't search the web</Text>
            </View>
          </CardContent>
        </Card>
      );
    default:
      return null;
  }
}
