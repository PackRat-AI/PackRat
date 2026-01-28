import { Text, useColorScheme } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { getWeatherIconByCondition } from 'expo-app/features/weather/lib/weatherIcons';
import { View } from 'react-native';
import type { ToolInvocation } from '../types';
import { ToolCard } from './ToolCard';

type WeatherToolOutput =
  | {
      success: true;
      data: {
        location: string;
        temperature: number;
        conditions: string;
        humidity: number;
        windSpeed: number;
      };
    }
  | {
      success: false;
      error: string;
    };

interface WeatherToolInput {
  location: string;
}

export type WeatherTool = {
  type: 'tool-getWeatherForLocation';
} & ToolInvocation<WeatherToolInput, WeatherToolOutput>;

interface WeatherGenerativeUIProps {
  toolInvocation: WeatherTool;
}

export function WeatherGenerativeUI({ toolInvocation }: WeatherGenerativeUIProps) {
  const { colors } = useColorScheme();

  switch (toolInvocation.state) {
    case 'input-streaming':
      return <ToolCard text="Initiating weather fetch..." icon="loading" />;
    case 'input-available':
      return (
        <ToolCard
          text={`Fetching weather for "${toolInvocation.input.location}"...`}
          icon="loading"
        />
      );
    case 'output-available':
      return toolInvocation.output.success ? (
        <View className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          {/* Header */}
          <View className="border-b border-gray-100 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
            <View className="flex-row items-center gap-2">
              <Icon name="map-marker-radius-outline" size={16} color={colors.primary} />
              <Text className="text-base font-semibold text-blue-800 dark:text-blue-200">
                Weather in {toolInvocation.output.data.location}
              </Text>
            </View>
          </View>

          {/* Main Weather Display */}
          <View className="p-4">
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Icon
                  name={getWeatherIconByCondition(toolInvocation.output.data.conditions)}
                  size={48}
                  color="#3b82f6"
                />
                <View>
                  <Text
                    className={`text-4xl font-light ${getTemperatureColor(toolInvocation.output.data.temperature)}`}
                  >
                    {toolInvocation.output.data.temperature}°
                  </Text>
                  <Text className="mt-1 text-base text-gray-600 dark:text-gray-300">
                    {toolInvocation.output.data.conditions}
                  </Text>
                </View>
              </View>
            </View>

            {/* Weather Details */}
            <View className="rounded-lg bg-gray-50 dark:bg-gray-700 p-3">
              <View className="flex-row justify-between">
                <View className="flex-1 items-center">
                  <View className="mb-1 flex-row items-center">
                    <Icon name="water" size={16} color="#3b82f6" />
                    <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Humidity
                    </Text>
                  </View>
                  <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {toolInvocation.output.data.humidity}%
                  </Text>
                </View>

                <View className="mx-3 w-px bg-gray-200 dark:bg-gray-600" />

                <View className="flex-1 items-center">
                  <View className="mb-1 flex-row items-center gap-1">
                    <Icon name="cloud" size={16} color="#3b82f6" />
                    <Text className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Wind
                    </Text>
                  </View>
                  <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {toolInvocation.output.data.windSpeed} mph
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <ToolCard
          text={`Couldn't fetch weather for "${toolInvocation.input.location}"`}
          icon="error"
        />
      );
    case 'output-error':
      return (
        <ToolCard
          text={`Error fetching weather for "${toolInvocation.input.location}"`}
          icon="error"
        />
      );
    default:
      return null;
  }
}

const getTemperatureColor = (temp: number) => {
  if (temp >= 80) return 'text-red-600';
  if (temp >= 60) return 'text-orange-500';
  if (temp >= 40) return 'text-blue-500';
  return 'text-blue-700';
};
