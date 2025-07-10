import { Icon } from '@roninoss/icons';
import { getWeatherIconByCondition } from 'expo-app/features/weather/lib/weatherIcons';
import { Text, View } from 'react-native';

interface WeatherData {
  success: boolean;
  location: string;
  temperature: number;
  conditions: string;
  humidity: number;
  windSpeed: number;
}

interface WeatherGenerativeUIProps {
  location: string;
  weatherData: WeatherData;
}

export function WeatherGenerativeUI({ location, weatherData }: WeatherGenerativeUIProps) {
  if (!weatherData.success) {
    return (
      <View className="mx-4 my-2 rounded-xl border border-red-200 bg-red-50 p-4">
        <View className="flex-row items-center">
          <Icon name="exclamation" size={20} color="#ef4444" />
          <Text className="font-medium text-red-700">Unable to get weather for {location}</Text>
        </View>
      </View>
    );
  }

  const getWeatherIcon = (conditions: string) => {
    const condition = conditions.toLowerCase();
    if (condition.includes('clear') || condition.includes('sunny')) {
      return 'sun';
    } else if (condition.includes('cloud')) {
      return 'cloud';
    } else if (condition.includes('rain')) {
      return 'cloud-rain';
    } else if (condition.includes('snow')) {
      return 'cloud-snow';
    } else if (condition.includes('storm')) {
      return 'cloud-lightning';
    }
    return 'cloud';
  };

  const getTemperatureColor = (temp: number) => {
    if (temp >= 80) return 'text-red-600';
    if (temp >= 60) return 'text-orange-500';
    if (temp >= 40) return 'text-blue-500';
    return 'text-blue-700';
  };

  return (
    <View className="mx-4 my-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <View className="border-b border-gray-100 bg-blue-50 px-4 py-3">
        <View className="flex-row items-center">
          <Icon name="map-marker-radius-outline" size={16} color="#2563eb" />
          <Text className="text-base font-semibold text-blue-800">
            Weather in {weatherData.location}
          </Text>
        </View>
      </View>

      {/* Main Weather Display */}
      <View className="p-4">
        <View className="mb-4 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Icon
              name={getWeatherIconByCondition(weatherData.conditions)}
              size={48}
              color="#3b82f6"
            />
            <View>
              <Text
                className={`text-4xl font-light ${getTemperatureColor(weatherData.temperature)}`}
              >
                {weatherData.temperature}°
              </Text>
              <Text className="mt-1 text-base text-gray-600">{weatherData.conditions}</Text>
            </View>
          </View>
        </View>

        {/* Weather Details */}
        <View className="rounded-lg bg-gray-50 p-3">
          <View className="flex-row justify-between">
            <View className="flex-1 items-center">
              <View className="mb-1 flex-row items-center">
                <Icon name="water" size={16} color="#3b82f6" />
                <Text className="text-sm font-medium text-gray-500">Humidity</Text>
              </View>
              <Text className="text-lg font-semibold text-gray-900">{weatherData.humidity}%</Text>
            </View>

            <View className="mx-3 w-px bg-gray-200" />

            <View className="flex-1 items-center">
              <View className="mb-1 flex-row items-center gap-1">
                <Icon name="cloud" size={16} color="#3b82f6" />
                <Text className="text-sm font-medium text-gray-500">Wind</Text>
              </View>
              <Text className="text-lg font-semibold text-gray-900">
                {weatherData.windSpeed} mph
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
