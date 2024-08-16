import React from 'react';
import { FeedScreen } from 'app/modules/feed';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import useTheme from 'app/hooks/useTheme';
import { DrawerToggleButton } from '@react-navigation/drawer';

export default function Packs() {
  const { currentTheme } = useTheme();

  return (
    <>
      {Platform.OS === 'web' && (
        <Head>
          <title>Packs</title>
        </Head>
      )}
      <Stack.Screen
        options={{
          // https://reactnavigation.org/docs/headers#setting-the-header-title
          title: 'Packs',
          headerRight: () => (
            <DrawerToggleButton tintColor={currentTheme.colors.tertiaryBlue} />
          ),

          headerStyle: {
            backgroundColor: currentTheme.colors.background,
          },
          headerTitleStyle: {
            fontSize: 24,
          },
          headerTintColor: currentTheme.colors.tertiaryBlue,

          // https://reactnavigation.org/docs/headers#adjusting-header-styles

          // https://reactnavigation.org/docs/headers#replacing-the-title-with-a-custom-component
        }}
      />
      <FeedScreen feedType="userPacks" />
    </>
  );
}
