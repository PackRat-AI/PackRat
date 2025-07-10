import { LargeTitleHeader } from '@packrat/ui/nativewindui';
import { Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { ScrollView, View } from 'react-native';

// Mock data for weather alerts
const WEATHER_ALERTS = [
  {
    id: '1',
    type: 'Rain',
    location: 'Appalachian Trail, GA',
    dates: 'May 15-17, 2024',
    severity: 'Moderate',
    details:
      'Expect 1-2 inches of rain over a 48-hour period. Trails may be muddy and creek crossings could be difficult.',
    icon: 'water',
    color: '#36A2EB',
  },
  {
    id: '2',
    type: 'Heat Advisory',
    location: 'Appalachian Trail, VA',
    dates: 'June 1-3, 2024',
    severity: 'High',
    details:
      'Temperatures expected to reach 90-95°F with high humidity. Increased risk of heat-related illness. Carry extra water and plan for shade breaks.',
    icon: 'lightbulb',
    color: '#FF6384',
  },
  {
    id: '3',
    type: 'Thunderstorms',
    location: 'Appalachian Trail, NC',
    dates: 'May 20, 2024',
    severity: 'High',
    details:
      'Severe thunderstorms with lightning risk. Avoid exposed ridges and summits during afternoon hours.',
    icon: 'lightning-bolt',
    color: '#FFCE56',
  },
  {
    id: '4',
    type: 'Wind Advisory',
    location: 'Appalachian Trail, NH',
    dates: 'June 5-6, 2024',
    severity: 'Moderate',
    details:
      'Sustained winds of 20-30 mph with gusts up to 45 mph. Secure loose items and be cautious of falling branches.',
    icon: 'arrow-left-right-bold',
    color: '#4BC0C0',
  },
];

function AlertSeverity({ severity }: { severity: string }) {
  const getColor = () => {
    switch (severity) {
      case 'High':
        return 'bg-red-500';
      case 'Moderate':
        return 'bg-amber-500';
      case 'Low':
        return 'bg-green-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <View className={cn('rounded-full px-2 py-1', getColor())}>
      <Text variant="caption2" className="font-medium text-white">
        {severity}
      </Text>
    </View>
  );
}

function WeatherAlertCard({ alert }: { alert: (typeof WEATHER_ALERTS)[0] }) {
  const { colors } = useColorScheme();
  return (
    <View className="mx-4 mb-3 overflow-hidden rounded-xl bg-card shadow-sm">
      <View className="border-b border-border p-4">
        <View className="flex-row items-center">
          <View
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: alert.color }}
          >
            <Icon name={alert.icon} size={24} color="white" />
          </View>

          <View className="ml-3 flex-1">
            <View className="flex-row items-center justify-between">
              <Text variant="heading" className="font-semibold">
                {alert.type}
              </Text>
              <AlertSeverity severity={alert.severity} />
            </View>
            <Text variant="subhead" className="text-muted-foreground">
              {alert.location} • {alert.dates}
            </Text>
          </View>
        </View>
      </View>

      <View className="p-4">
        <View className="flex-row items-start">
          <View className="mr-2 mt-1 text-muted-foreground">
            <Icon name="information-outline" size={16} color={colors.grey} />
          </View>
          <Text variant="body" className="flex-1">
            {alert.details}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function WeatherAlertsScreen() {
  return (
    <>
      <LargeTitleHeader title="Weather Alerts" />
      <ScrollView className="flex-1">
        <View className="p-4">
          <Text variant="subhead" className="mb-2 text-muted-foreground">
            Current weather alerts for your planned trips
          </Text>
        </View>

        <View className="pb-4">
          {WEATHER_ALERTS.map((alert) => (
            <WeatherAlertCard key={alert.id} alert={alert} />
          ))}
        </View>

        <View className="mx-4 my-2 rounded-lg bg-card p-4">
          <Text variant="footnote" className="text-muted-foreground">
            Weather data last updated: Today, 9:45 AM
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
