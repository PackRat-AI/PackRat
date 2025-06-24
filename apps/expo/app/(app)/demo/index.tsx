import { useHeaderHeight } from '@react-navigation/elements';
import { Icon } from '@roninoss/icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { cssInterop } from 'nativewind';
import * as React from 'react';
import { useState } from 'react';
import { Linking, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from 'expo-app/components/Card';

import { Button } from 'nativewindui/Button';
import { LargeTitleHeader } from 'nativewindui/LargeTitleHeader';
import { Text } from 'nativewindui/Text';
import { ThemeToggle } from 'expo-app/components/ThemeToggle';
import { useColorScheme } from 'expo-app/lib/useColorScheme';
import { useHeaderSearchBar } from 'expo-app/lib/useHeaderSearchBar';

cssInterop(FlashList, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});

export default function Screen() {
  const [hasSeenConsent, setHasSeenConsent] = useState(false);

  const searchValue = useHeaderSearchBar({ hideWhenScrolling: COMPONENTS.length === 0 });
  // const [searchValue, setSearchValue] = useState('');

  const data = searchValue
    ? COMPONENTS.filter((c) => c.name.toLowerCase().includes(searchValue.toLowerCase()))
    : COMPONENTS;

  if (!hasSeenConsent) {
    // return <Redirect href="/consent-modal" />;
  }

  return (
    <>
      <LargeTitleHeader
        title="Demo"
        backVisible={false}
        searchBar={{ iosHideWhenScrolling: true }}
        rightView={ThemeToggle}
      />
      <FlashList
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        data={data}
        estimatedItemSize={200}
        contentContainerClassName="py-4 android:pb-12"
        extraData={searchValue}
        removeClippedSubviews={false} // used for selecting text on android
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={renderItemSeparator}
        renderItem={renderItem}
        ListEmptyComponent={COMPONENTS.length === 0 ? ListEmptyComponent : undefined}
      />
    </>
  );
}

function ListEmptyComponent() {
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const headerHeight = useHeaderHeight();
  const { colors } = useColorScheme();
  const height = dimensions.height - headerHeight - insets.bottom - insets.top;

  return (
    <View style={{ height }} className="flex-1 items-center justify-center gap-1 px-12">
      <Icon name="file-plus-outline" size={42} color={colors.grey} />
      <Text variant="title3" className="pb-1 text-center font-semibold">
        No Components Installed
      </Text>
      <Text color="tertiary" variant="subhead" className="pb-4 text-center">
        You can install any of the free components from the{' '}
        <Text
          onPress={() => Linking.openURL('https://nativewindui.com')}
          variant="subhead"
          className="text-primary"
        >
          NativeWindUI
        </Text>
        {' website.'}
      </Text>
    </View>
  );
}

type ComponentItem = { name: string; component: React.FC };

function keyExtractor(item: ComponentItem) {
  return item.name;
}

function renderItemSeparator() {
  return <View className="p-2" />;
}

function renderItem({ item }: { item: ComponentItem }) {
  return (
    <Card title={item.name}>
      <item.component />
    </Card>
  );
}

const COMPONENTS: ComponentItem[] = [
  {
    name: 'Links',
    component: function LinksExample() {
      const router = useRouter();
      return (
        <View className="gap-2">
          <View className="gap-2">
            <Text>
              <Text>Main Screens</Text>
            </Text>
            <Button onPress={() => router.push('/')}>
              <Text>Dashboard</Text>
            </Button>
            <Button onPress={() => router.push('/packs')}>
              <Text>Packs</Text>
            </Button>
            <Button onPress={() => router.push('/items')}>
              <Text>Items</Text>
            </Button>
            <Button onPress={() => router.push('/catalog')}>
              <Text>Catalog</Text>
            </Button>
          </View>
          <View className="gap-2">
            <Text>
              <Text>Modals</Text>
            </Text>
            <Button onPress={() => router.push('/pack/new')}>
              <Text>New Pack</Text>
            </Button>
            <Button onPress={() => router.push('/item/new')}>
              <Text>New Item</Text>
            </Button>
          </View>
          <View className="gap-2">
            <Text>Additional Screens</Text>
            <Button onPress={() => router.push('/settings')}>
              <Text>Settings</Text>
            </Button>
            <Button onPress={() => router.push('/auth/one-time-password')}>
              <Text>OTP</Text>
            </Button>
            <Button onPress={() => router.push('/auth')}>
              <Text>Login</Text>
            </Button>
            <Button onPress={() => router.push('/messages/conversations')}>
              <Text>Messages (Conversations)</Text>
            </Button>
            <Button onPress={() => router.push('/messages/chat')}>
              <Text>Messages (Chat)</Text>
            </Button>
            <Button onPress={() => router.push('/ai-chat')}>
              <Text>AI Chat</Text>
            </Button>
            <Button onPress={() => router.push('/ai-chat')}>
              <Text>AI Chat (Better UI)</Text>
            </Button>
          </View>
        </View>
      );
    },
  },
  {
    name: 'Text',
    component: function TextExample() {
      return (
        <View className="gap-2">
          <Text variant="largeTitle" className="text-center">
            Large Title
          </Text>
          <Text variant="title1" className="text-center">
            Title 1
          </Text>
          <Text variant="title2" className="text-center">
            Title 2
          </Text>
          <Text variant="title3" className="text-center">
            Title 3
          </Text>
          <Text variant="heading" className="text-center">
            Heading
          </Text>
          <Text variant="body" className="text-center">
            Body
          </Text>
          <Text variant="callout" className="text-center">
            Callout
          </Text>
          <Text variant="subhead" className="text-center">
            Subhead
          </Text>
          <Text variant="footnote" className="text-center">
            Footnote
          </Text>
          <Text variant="caption1" className="text-center">
            Caption 1
          </Text>
          <Text variant="caption2" className="text-center">
            Caption 2
          </Text>
        </View>
      );
    },
  },
  {
    name: 'Selectable Text',
    component: function SelectableTextExample() {
      return (
        <Text uiTextView selectable>
          Long press or double press this text
        </Text>
      );
    },
  },
  {
    name: 'Button',
    component: function ButtonExample() {
      return (
        <View className="gap-4">
          <Button>
            <Text>Primary</Text>
          </Button>
          <Button variant="secondary">
            <Text>Secondary</Text>
          </Button>
          <Button variant="tonal">
            <Text>Tertiary</Text>
          </Button>
          <Button variant="plain">
            <Text>Plain</Text>
          </Button>
        </View>
      );
    },
  },
];
