import { AdaptiveSearchHeader } from '@packrat/ui/nativewindui/AdaptiveSearchHeader';
import { Avatar, AvatarFallback, AvatarImage } from '@packrat/ui/nativewindui/Avatar';
import { Button } from '@packrat/ui/nativewindui/Button';
import { LargeTitleHeader } from '@packrat/ui/nativewindui/LargeTitleHeader';
import {
  List,
  type ListDataItem,
  type ListRenderItemInfo,
  ListSectionHeader,
} from '@packrat/ui/nativewindui/List';
import { Text } from '@packrat/ui/nativewindui/Text';
import { Icon, type MaterialIconName } from '@roninoss/icons';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Platform, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsAndroidStyleScreen() {
  const insets = useSafeAreaInsets();
  return (
    <>
      {Platform.OS === 'ios' && (
        <LargeTitleHeader
          title="Settings"
          rightView={() => {
            return (
              <Avatar alt="NativeWindUI's avatar" className="h-8 w-8">
                <AvatarImage
                  source={{
                    uri: 'https://pbs.twimg.com/profile_images/1782428433898708992/1voyv4_A_400x400.jpg',
                  }}
                />
                <AvatarFallback>
                  <Text>NU</Text>
                </AvatarFallback>
              </Avatar>
            );
          }}
          searchBar={{
            content: (
              <View
                className={cn(
                  'flex-1',
                  Platform.OS === 'ios' && 'bg-background dark:bg-background',
                )}
              >
                <Animated.View entering={FadeInUp.delay(150)}>
                  <SearchContent />
                </Animated.View>
              </View>
            ),
          }}
        />
      )}
      <List
        rootStyle={Platform.select({
          ios: undefined,
          default: { paddingTop: insets.top },
        })}
        stickyHeaderIndices={Platform.select({ ios: undefined, default: [1] })}
        rootClassName="bg-background ios:bg-background"
        contentContainerClassName="pt-4 ios:pt-0"
        contentInsetAdjustmentBehavior="automatic"
        variant="full-width"
        data={DATA}
        estimatedItemSize={92}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        sectionHeaderAsGap
      />
    </>
  );
}

function renderItem<T extends (typeof DATA)[number]>(info: ListRenderItemInfo<T>) {
  if (info.item === 'material-top-header') {
    return <MaterialTopHeader />;
  }
  if (info.item === 'material-search-header') {
    return (
      <AdaptiveSearchHeader
        materialUseSafeAreaTop={false}
        searchBar={{
          placeholder: 'Search Settings',
          content: <SearchContent />,
        }}
      />
    );
  }

  if (typeof info.item === 'string') {
    return <ListSectionHeader {...info} />;
  }
  return (
    <Button
      size="lg"
      variant="plain"
      className="ios:gap-3 ios:px-6 justify-start px-8 py-5"
      onPress={() => console.log('onPress')}
    >
      {info.item.leftView}
      <View className="flex-1">
        <Text className="pl-4 text-xl font-normal">{info.item.title}</Text>
        <Text className="pl-4 text-base font-normal text-muted-foreground">
          {info.item.subTitle}
        </Text>
      </View>
    </Button>
  );
}

function IconView({ name }: { name: MaterialIconName }) {
  const { colors } = useColorScheme();
  return (
    <View>
      <Icon
        name={name}
        size={Platform.select({ ios: 27, default: 24 })}
        color={colors.foreground}
      />
    </View>
  );
}

function MaterialTopHeader() {
  return (
    <View className="pb gap-2 px-5 pb-5 pt-10">
      <View className="items-end">
        <Avatar alt="Your Name's avatar" className="h-12 w-12">
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
      <View>
        <Text variant="largeTitle">Settings</Text>
      </View>
    </View>
  );
}

function SearchContent() {
  const { colors } = useColorScheme();
  return (
    <View className="items-center gap-4 pt-8">
      <Icon name="magnify" color={colors.primary} />
      <Text>Search Settings</Text>
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
  ...Platform.select({
    ios: [],
    default: ['material-top-header', 'material-search-header'],
  }),
  {
    id: '4',
    title: 'Wi-Fi',
    rightText: "NU's iPhone",
    leftView: <IconView name="wifi" />,
    subTitle: 'Network & Security',
  },
  {
    id: '5',
    title: 'Play Station',
    leftView: <IconView name="sony-playstation" />,
    subTitle: 'Connected Devices',
  },
  {
    id: '6',
    title: 'Gift Cards',
    leftView: <IconView name="card-giftcard" />,
    subTitle: 'Redeem & Balance',
  },

  {
    id: '7',
    title: 'Locations',
    leftView: <IconView name="map-outline" />,
    subTitle: 'Privacy & Security',
  },
  {
    id: '8',
    title: 'Notifications',
    leftView: <IconView name="bell-outline" />,
    subTitle: 'Alerts & Sounds',
  },
  {
    id: '9',
    title: 'Focus',
    leftView: <IconView name="weather-night" />,
    subTitle: 'Do Not Disturb & Focus',
  },
  {
    id: '10',
    title: 'Screen Time',
    leftView: <IconView name="timer-outline" />,
    subTitle: 'App Limits & Content & Privacy Restrictions',
  },

  {
    id: '11',
    title: 'General',
    leftView: <IconView name="cog-outline" />,
    subTitle: 'Language & Region, Profiles, Device Management',
  },
  {
    id: '12',
    title: 'Game Center',
    leftView: <IconView name="controller-classic-outline" />,
    subTitle: 'Google Play Settings',
  },
  {
    id: '13',
    title: 'Accessibility',
    leftView: <IconView name="accessibility" />,
    subTitle: 'Vision, Hearing, Physical & Motor Skills, Learning & Literacy',
  },
  {
    id: '14',
    title: 'Artificial Intelligence',
    leftView: <IconView name="star-four-points" />,
    subTitle: 'Search, QuickType, Handoff, Spotlight Suggestions',
  },
];
