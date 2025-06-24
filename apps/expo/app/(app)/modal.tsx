import { Icon } from '@roninoss/icons';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { ActivityIndicator } from 'nativewindui/ActivityIndicator';
import { Alert } from 'nativewindui/Alert';
import type { AlertRef } from 'nativewindui/Alert/types';
import { Button } from 'nativewindui/Button';

import { Text } from 'nativewindui/Text';
import { useAuth } from 'expo-app/features/auth/hooks/useAuth';
import { useColorScheme } from 'expo-app/lib/useColorScheme';

export default function ModalScreen() {
  const { colorScheme, colors } = useColorScheme();
  const { deleteAccount, isLoading } = useAuth();

  const alertRef = React.useRef<AlertRef>(null);

  return (
    <ScrollView className="flex-1 px-4 py-6">
      <View className="gap-6">
        <StatusBar
          style={Platform.OS === 'ios' ? 'light' : colorScheme === 'dark' ? 'light' : 'dark'}
        />

        <View>
          <Text variant="subhead" className="mb-4">
            Danger Zone
          </Text>

          <Button
            variant="secondary"
            disabled={isLoading}
            onPress={() =>
              alertRef.current?.prompt({
                title: 'Delete Account?',
                message: 'Type "DELETE" to confirm.',
                materialIcon: { name: 'trash-can' },
                materialWidth: 370,
                prompt: {
                  type: 'plain-text',
                  keyboardType: 'default',
                },
                buttons: [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                  },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async (text) => {
                      if (text === 'DELETE') {
                        try {
                          await deleteAccount(); // redirection is handled in the hook
                        } catch (error) {
                          setTimeout(() => {
                            alertRef.current?.alert({
                              title: 'Error',
                              message: 'Failed to delete account.',
                              buttons: [
                                {
                                  text: 'OK',
                                  style: 'default',
                                },
                              ],
                            });
                          }, 0);
                        }
                      } else {
                        setTimeout(() => {
                          alertRef.current?.alert({
                            title: 'Error',
                            message: 'Invalid confirmation text.',
                            buttons: [
                              {
                                text: 'OK',
                                style: 'default',
                              },
                            ],
                          });
                        }, 0);
                      }
                    },
                  },
                ],
              })
            }
            className="flex-row items-center justify-between p-2"
          >
            <View className="flex-row items-center gap-3">
              {isLoading ? (
                <ActivityIndicator size={24} color={colors.destructive} />
              ) : (
                <Icon name="trash-can-outline" color={colors.destructive} />
              )}
              <Text style={{ color: colors.destructive }}>Delete Account</Text>
            </View>
            <Icon name="chevron-right" color={colors.destructive} />
          </Button>
        </View>

        <Alert buttons={[]} ref={alertRef} />
      </View>
    </ScrollView>
  );
}
