import React from 'react';
import { AddPackScreen } from 'app/modules/pack';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';

export default function Pack() {
  return (
    <>
      {Platform.OS === 'web' && (
        <Head>
          <title>Create Pack</title>
          <meta name="description" content="Create Pack" />
        </Head>
      )}
      <Stack.Screen
        options={{
          // https://reactnavigation.org/docs/headers#setting-the-header-title
          title: 'Create Pack',
          // https://reactnavigation.org/docs/headers#adjusting-header-styles

          // https://reactnavigation.org/docs/headers#replacing-the-title-with-a-custom-component
        }}
      />
      <AddPackScreen />
    </>
  );
}
