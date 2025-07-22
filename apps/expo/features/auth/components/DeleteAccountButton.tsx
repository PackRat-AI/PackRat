import type { AlertRef } from '@packrat/ui/nativewindui';
import { ActivityIndicator, Alert, Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useAuth } from 'expo-app/features/auth/hooks/useAuth';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import React, { useState, useRef } from 'react';
import { View } from 'react-native';

export function DeleteAccountButton() {
  const { colors } = useColorScheme();
  const { deleteAccount } = useAuth();
  const alertRef = useRef<AlertRef>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        disabled={isDeleting}
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
                      setIsDeleting(true);
                      await deleteAccount(); // handles redirect
                    } catch (_error) {
                      setTimeout(() => {
                        alertRef.current?.alert({
                          title: 'Error',
                          message: 'Failed to delete account.',
                          buttons: [{ text: 'OK', style: 'default' }],
                        });
                      }, 0);
                    } finally {
                      setIsDeleting(false);
                    }
                  } else {
                    setTimeout(() => {
                      alertRef.current?.alert({
                        title: 'Error',
                        message: 'Invalid confirmation text.',
                        buttons: [{ text: 'OK', style: 'default' }],
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
          {isDeleting ? (
            <ActivityIndicator size={24} color={colors.destructive} />
          ) : (
            <Icon name="trash-can-outline" color={colors.destructive} />
          )}
          <Text style={{ color: colors.destructive }}>Delete Account</Text>
        </View>
        <Icon name="chevron-right" color={colors.destructive} />
      </Button>

      <Alert title="" buttons={[]} ref={alertRef} />
    </>
  );
}
