import { Avatar, AvatarFallback, AvatarImage } from '@packrat/ui/nativewindui/Avatar';
import { LargeTitleHeader } from '@packrat/ui/nativewindui/LargeTitleHeader';
import {
  ESTIMATED_ITEM_HEIGHT,
  List,
  type ListDataItem,
  ListItem,
  type ListRenderItemInfo,
  ListSectionHeader,
} from '@packrat/ui/nativewindui/List';
import { Text } from '@packrat/ui/nativewindui/Text';
import { Icon, type MaterialIconName } from '@roninoss/icons';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { View } from 'react-native';

export default function SettingsIosStyleScreen() {
  return (
    <>
      <LargeTitleHeader title="Settings" searchBar={{ iosHideWhenScrolling: true }} />
      <List
        contentContainerClassName="pt-4"
        contentInsetAdjustmentBehavior="automatic"
        variant="insets"
        data={DATA}
        estimatedItemSize={ESTIMATED_ITEM_HEIGHT.titleOnly}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        sectionHeaderAsGap
      />
    </>
  );
}

function renderItem<T extends (typeof DATA)[number]>(info: ListRenderItemInfo<T>) {
  if (typeof info.item === 'string') {
    return <ListSectionHeader {...info} />;
  }
  return (
    <ListItem
      className={cn(
        'ios:pl-0 pl-2',
        info.index === 0 && 'ios:border-t-0 border-border/25 dark:border-border/80 border-t',
      )}
      titleClassName="text-lg"
      leftView={info.item.leftView}
      rightView={
        <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
          {info.item.rightText && (
            <Text variant="callout" className="ios:px-0 px-2 text-muted-foreground">
              {info.item.rightText}
            </Text>
          )}
          {info.item.badge && (
            <View className="h-5 w-5 items-center justify-center rounded-full bg-destructive">
              <Text variant="footnote" className="font-bold leading-4 text-destructive-foreground">
                {info.item.badge}
              </Text>
            </View>
          )}
          <ChevronRight />
        </View>
      }
      {...info}
      onPress={() => console.log('onPress')}
    />
  );
}

function ChevronRight() {
  const { colors } = useColorScheme();
  return <Icon name="chevron-right" size={17} color={colors.grey} />;
}

function IconView({ className, name }: { className?: string; name: MaterialIconName }) {
  return (
    <View className="px-3">
      <View className={cn('h-6 w-6 items-center justify-center rounded-md', className)}>
        <Icon name={name} size={15} color="white" />
      </View>
    </View>
  );
}

function keyExtractor(item: (Omit<ListDataItem, string> & { id: string }) | string) {
  return typeof item === 'string' ? item : item.id;
}

type MockData =
  | {
      id: string;
      title: string;
      subTitle?: string;
      leftView?: React.ReactNode;
      rightText?: string;
      badge?: number;
    }
  | string;

const DATA: MockData[] = [
  {
    id: '1',
    title: 'NativeWind UI',
    subTitle: 'Apple ID, iCloud+ & Purchases',
    leftView: (
      <View className="px-3">
        <Avatar alt="NativeWindUI's avatar">
          <AvatarImage
            source={{
              uri: 'https://pbs.twimg.com/profile_images/1782428433898708992/1voyv4_A_400x400.jpg',
            }}
          />
          <AvatarFallback>
            <Text>NU</Text>
          </AvatarFallback>
        </Avatar>
      </View>
    ),
  },
  {
    id: '2',
    title: 'Team members',
    leftView: (
      <View className="flex-row px-3 ">
        <Avatar alt="Zach Nugent's avatar" className="h-6 w-6">
          <AvatarImage
            source={{
              uri: 'https://avatars.githubusercontent.com/u/63797719?v=4',
            }}
          />
          <AvatarFallback>
            <Text>ZN</Text>
          </AvatarFallback>
        </Avatar>
        <Avatar alt="Dan Stepanov's avatar" className="-ml-2 h-6 w-6">
          <AvatarImage
            source={{
              uri: 'https://avatars.githubusercontent.com/u/5482800?v=4',
            }}
          />
          <AvatarFallback>
            <Text>DS</Text>
          </AvatarFallback>
        </Avatar>
      </View>
    ),
  },

  {
    id: '3',
    title: 'Memberships & Subscriptions',
    badge: 3,
  },
  'gap 2',
  {
    id: '4',
    title: 'Wi-Fi',
    rightText: "NU's iPhone",
    leftView: <IconView name="wifi" className="bg-blue-500" />,
  },
  {
    id: '5',
    title: 'Play Station',
    leftView: <IconView name="sony-playstation" className="bg-blue-600" />,
  },
  {
    id: '6',
    title: 'Gift Cards',
    leftView: <IconView name="card-giftcard" className="bg-green-500" />,
  },

  'gap 3',
  {
    id: '7',
    title: 'Locations',
    leftView: <IconView name="map-outline" className="bg-red-500" />,
  },
  {
    id: '8',
    title: 'Notifications',
    leftView: <IconView name="bell-outline" className="bg-destructive" />,
  },
  {
    id: '9',
    title: 'Focus',
    leftView: <IconView name="weather-night" className="bg-violet-500" />,
  },
  {
    id: '10',
    title: 'Screen Time',
    leftView: <IconView name="timer-outline" className="bg-violet-600" />,
  },
  'gap 4',
  {
    id: '11',
    title: 'General',
    leftView: <IconView name="cog-outline" className="bg-gray-500" />,
  },
  {
    id: '12',
    title: 'Game Center',
    leftView: <IconView name="controller-classic-outline" className="bg-gray-600" />,
  },
  {
    id: '13',
    title: 'Accessibility',
    leftView: <IconView name="accessibility" className="bg-sky-500" />,
  },
  {
    id: '14',
    title: 'Artificial Intelligence',
    leftView: <IconView name="star-four-points" className="bg-sky-400" />,
  },
];
