import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  LargeTitleHeader,
  List,
  ListItem,
  Text,
} from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

// Mock data for upcoming trips with hardcoded dates
const UPCOMING_TRIPS = [
  {
    id: '1',
    name: 'Appalachian Trail Section Hike',
    location: 'Great Smoky Mountains, TN',
    startDate: 'May 15, 2024',
    endDate: 'May 22, 2024',
    distance: '72 miles',
    duration: '7 days',
    packStatus: 'In Progress',
    packWeight: '11.8 lbs',
    packCompletion: 85,
    image:
      'https://images.unsplash.com/photo-1465311530779-5241f5a29892?q=80&w=400&auto=format&fit=crop',
    weather: {
      forecast: 'Partly Cloudy',
      highTemp: '68°F',
      lowTemp: '42°F',
      precipitation: '30%',
      alerts: ['Rain expected on days 3-4'],
    },
    members: [
      {
        id: '1',
        name: 'You',
        avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
      },
      {
        id: '2',
        name: 'Mike Chen',
        avatar: 'https://randomuser.me/api/portraits/men/22.jpg',
      },
    ],
  },
  {
    id: '2',
    name: 'Weekend Backpacking Trip',
    location: 'Shenandoah National Park, VA',
    startDate: 'May 29, 2024',
    endDate: 'May 31, 2024',
    distance: '24 miles',
    duration: '2 days',
    packStatus: 'Not Started',
    packWeight: 'N/A',
    packCompletion: 0,
    image:
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=400&auto=format&fit=crop',
    weather: {
      forecast: 'Sunny',
      highTemp: '75°F',
      lowTemp: '50°F',
      precipitation: '10%',
      alerts: [],
    },
    members: [
      {
        id: '1',
        name: 'You',
        avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
      },
      {
        id: '2',
        name: 'Sarah Johnson',
        avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
      },
      {
        id: '3',
        name: 'Alex Rodriguez',
        avatar: 'https://randomuser.me/api/portraits/men/67.jpg',
      },
    ],
  },
];

// Mock data for trip checklist
const TRIP_CHECKLIST = [
  { id: '1', task: 'Finalize gear list', completed: true },
  { id: '2', task: 'Check weather forecast', completed: true },
  { id: '3', task: 'Purchase food supplies', completed: false },
  { id: '4', task: 'Arrange transportation', completed: true },
  { id: '5', task: 'Inform emergency contact', completed: false },
  { id: '6', task: 'Check trail conditions', completed: true },
  { id: '7', task: 'Charge electronics', completed: false },
  { id: '8', task: 'Print maps/permits', completed: false },
];

function PackStatus({ status, completion }: { status: string; completion: number }) {
  let statusColor = 'bg-amber-500';
  const statusText = status;

  if (status === 'Complete') {
    statusColor = 'bg-green-500';
  } else if (status === 'Not Started') {
    statusColor = 'bg-red-500';
  }

  return (
    <View>
      <View className="flex-row items-center">
        <View className={cn('mr-1 h-2 w-2 rounded-full', statusColor)} />
        <Text variant="footnote" className="text-muted-foreground">
          {statusText}
        </Text>
      </View>
      {status === 'In Progress' && (
        <View className="mt-1 h-1 w-16 rounded-full bg-muted">
          <View className="h-1 rounded-full bg-primary" style={{ width: `${completion}%` }} />
        </View>
      )}
    </View>
  );
}

function MemberAvatars({ members }: { members: { id: string; name: string; avatar: string }[] }) {
  return (
    <View className="flex-row">
      {members.map((member, index) => (
        <Avatar
          key={member.id}
          className={cn('h-6 w-6 border border-background', index > 0 && '-ml-2')}
        >
          <AvatarImage source={{ uri: member.avatar }} />
          <AvatarFallback>
            <Text>{member.name.substring(0, 1)}</Text>
          </AvatarFallback>
        </Avatar>
      ))}
    </View>
  );
}

function TripImage({ uri }: { uri: string }) {
  return (
    <View className="px-3">
      <View className="h-12 w-12 overflow-hidden rounded-md">
        <Avatar className="h-12 w-12">
          <AvatarImage source={{ uri }} />
          <AvatarFallback>
            <Icon name="map" size={20} color="white" />
          </AvatarFallback>
        </Avatar>
      </View>
    </View>
  );
}

export default function UpcomingTripsScreen() {
  const { colors } = useColorScheme();
  const [selectedTrip, setSelectedTrip] = useState(UPCOMING_TRIPS[0]);

  return (
    <>
      <LargeTitleHeader title="Upcoming Trips" />
      <ScrollView className="flex-1">
        <View className="p-4">
          <Text variant="subhead" className="mb-2 text-muted-foreground">
            Your planned hiking adventures
          </Text>
        </View>

        <List
          data={UPCOMING_TRIPS.map((trip) => ({
            title: trip.name,
            subTitle: `${trip.location} • ${trip.startDate} to ${trip.endDate}`,
          }))}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item, index }) => {
            const trip = UPCOMING_TRIPS[index];
            return (
              <ListItem
                item={item}
                leftView={<TripImage uri={trip.image} />}
                rightView={
                  <View className="flex-row items-center">
                    <PackStatus status={trip.packStatus} completion={trip.packCompletion} />
                  </View>
                }
                onPress={() => setSelectedTrip(trip)}
                className={
                  selectedTrip.id === trip.id
                    ? 'bg-muted/50 dark:bg-slate-950'
                    : 'dark:bg-transparent'
                }
              />
            );
          }}
        />

        <View className="mx-4 my-4 rounded-lg bg-card">
          <View className="border-border/25 dark:border-border/80 border-b p-4">
            <Text variant="heading" className="font-semibold">
              {selectedTrip.name}
            </Text>
            <Text variant="subhead" className="mt-1 text-muted-foreground">
              {selectedTrip.location}
            </Text>
          </View>

          <View className="flex-row justify-between p-4">
            <View className="flex-1">
              <Text variant="footnote" className="text-muted-foreground">
                DATES
              </Text>
              <Text variant="subhead" className="mt-1">
                {selectedTrip.startDate} - {selectedTrip.endDate}
              </Text>
            </View>
            <View className="flex-1">
              <Text variant="footnote" className="text-muted-foreground">
                DISTANCE
              </Text>
              <Text variant="subhead" className="mt-1">
                {selectedTrip.distance}
              </Text>
            </View>
            <View className="flex-1">
              <Text variant="footnote" className="text-muted-foreground">
                DURATION
              </Text>
              <Text variant="subhead" className="mt-1">
                {selectedTrip.duration}
              </Text>
            </View>
          </View>

          <View className="flex-row justify-between px-4 pb-4">
            <View className="flex-1">
              <Text variant="footnote" className="text-muted-foreground">
                PACK
              </Text>
              <Text variant="subhead" className="mt-1">
                {selectedTrip.packWeight}
              </Text>
            </View>
            <View className="flex-1">
              <Text variant="footnote" className="text-muted-foreground">
                MEMBERS
              </Text>
              <View className="mt-1">
                <MemberAvatars members={selectedTrip.members} />
              </View>
            </View>
            <View className="flex-1">
              <Text variant="footnote" className="text-muted-foreground">
                WEATHER
              </Text>
              <Text variant="subhead" className="mt-1">
                {selectedTrip.weather.forecast}
              </Text>
            </View>
          </View>
        </View>

        <View className="mx-4 my-4 rounded-lg bg-card">
          <View className="border-border/25 dark:border-border/80 border-b p-4">
            <Text variant="heading" className="font-semibold">
              Weather Forecast
            </Text>
          </View>

          <View className="p-4">
            <View className="mb-2 flex-row justify-between">
              <View className="flex-row items-center">
                <Icon name="thermometer" size={16} color={colors.foreground} className="mr-1" />
                <Text variant="subhead">High: {selectedTrip.weather.highTemp}</Text>
              </View>
              <View className="flex-row items-center">
                <Icon name="thermometer-low" size={16} color={colors.foreground} className="mr-1" />
                <Text variant="subhead">Low: {selectedTrip.weather.lowTemp}</Text>
              </View>
              <View className="flex-row items-center">
                <Icon name="water-percent" size={16} color={colors.foreground} className="mr-1" />
                <Text variant="subhead">Precip: {selectedTrip.weather.precipitation}</Text>
              </View>
            </View>

            {selectedTrip.weather.alerts.length > 0 && (
              <View className="mt-2 rounded-md bg-amber-500/10 p-3">
                <Text variant="subhead" className="font-medium text-amber-600 dark:text-amber-400">
                  Weather Alerts
                </Text>
                {selectedTrip.weather.alerts.map((alert) => (
                  <Text
                    key={alert}
                    variant="footnote"
                    className="mt-1 text-amber-600 dark:text-amber-400"
                  >
                    • {alert}
                  </Text>
                ))}
              </View>
            )}
          </View>
        </View>

        <View className="mx-4 my-4 mb-8 rounded-lg bg-card">
          <View className="border-border/25 dark:border-border/80 border-b p-4">
            <Text variant="heading" className="font-semibold">
              Trip Preparation
            </Text>
          </View>

          <List
            data={TRIP_CHECKLIST.map((item) => ({
              title: item.task,
              subTitle: '',
            }))}
            keyExtractor={(_, index) => index.toString()}
            renderItem={({ item, index }) => {
              const checklistItem = TRIP_CHECKLIST[index];
              return (
                <ListItem
                  item={item}
                  leftView={
                    <View className="px-3">
                      <View
                        className={cn(
                          'h-5 w-5 items-center justify-center rounded-full border',
                          checklistItem.completed
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground',
                        )}
                      >
                        {checklistItem.completed && <Icon name="check" size={12} color="white" />}
                      </View>
                    </View>
                  }
                  className={checklistItem.completed ? 'opacity-60' : ''}
                />
              );
            }}
          />

          <View className="p-4 pt-0">
            <Text variant="footnote" className="text-muted-foreground">
              {TRIP_CHECKLIST.filter((item) => item.completed).length} of {TRIP_CHECKLIST.length}{' '}
              tasks completed
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
