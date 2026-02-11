import type { AlertRef } from '@packrat/ui/nativewindui';
import { ActivityIndicator, Alert, Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useAuth } from 'expo-app/features/auth/hooks/useAuth';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRef, useState } from 'react';
import { View } from 'react-native';

export function DeleteAccountButton() {
  const { colors } = useColorScheme();
  const { deleteAccount } = useAuth();
  const { t } = useTranslation();
  const alertRef = useRef<AlertRef>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        disabled={isDeleting}
        onPress={() =>
          alertRef.current?.prompt({
            title: t('auth.deleteAccountQuestion'),
            message: t('auth.deleteAccountConfirmation'),
            materialIcon: { name: 'trash-can' },
            materialWidth: 370,
            prompt: {
              type: 'plain-text',
              keyboardType: 'default',
            },
            buttons: [
              {
                text: t('common.cancel'),
                style: 'cancel',
              },
              {
                text: t('common.delete'),
                style: 'destructive',
                onPress: async (text) => {
                  if (text === 'DELETE') {
                    try {
                      setIsDeleting(true);
                      await deleteAccount(); // handles redirect
                    } catch (_error) {
                      setTimeout(() => {
                        alertRef.current?.alert({
                          title: t('common.error'),
                          message: t('auth.deleteAccountFailed'),
                          buttons: [{ text: t('common.ok'), style: 'default' }],
                        });
                      }, 0);
                    } finally {
                      setIsDeleting(false);
                    }
                  } else {
                    setTimeout(() => {
                      alertRef.current?.alert({
                        title: t('common.error'),
                        message: t('auth.invalidConfirmationText'),
                        buttons: [{ text: t('common.ok'), style: 'default' }],
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
          <Text style={{ color: colors.destructive }}>{t('auth.deleteAccount')}</Text>
        </View>
        <Icon name="chevron-right" color={colors.destructive} />
      </Button>

      <Alert title="" buttons={[]} ref={alertRef} />
    </>
  );
}
