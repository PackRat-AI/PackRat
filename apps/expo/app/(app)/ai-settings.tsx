/**
 * AI Settings Screen
 * Example screen showing how to integrate OnDeviceAISettings component
 */
import { Text } from '@packrat/ui/nativewindui';
import { OnDeviceAISettings } from 'expo-app/features/ai/components/OnDeviceAISettings';
import { Stack } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';

export default function AISettingsScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'AI Settings',
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView className="flex-1 bg-background">
        <View className="p-4 gap-4">
          <View>
            <Text className="text-2xl font-bold mb-2">AI Settings</Text>
            <Text className="text-muted-foreground mb-4">
              Configure how PackRat AI works on your device
            </Text>
          </View>
          
          <OnDeviceAISettings />
          
          {/* Additional Info Section */}
          <View className="p-4 bg-card rounded-lg mt-2">
            <Text className="text-lg font-semibold mb-2">About the Models</Text>
            <Text className="text-muted-foreground text-sm leading-5">
              PackRat uses optimized AI models designed for mobile devices. 
              The on-device model (Qwen3-600m) is approximately 600MB and 
              provides fast, private responses without requiring an internet 
              connection after download.
            </Text>
          </View>

          <View className="p-4 bg-card rounded-lg">
            <Text className="text-lg font-semibold mb-2">Privacy & Data</Text>
            <Text className="text-muted-foreground text-sm leading-5">
              When using on-device mode, your conversations never leave your 
              device. All AI processing happens locally, ensuring your hiking 
              plans and gear discussions remain completely private.
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
