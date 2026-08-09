import type { BottomSheetModal } from '@expo/ui/community/bottom-sheet';
import { Sheet, SheetView } from '@packrat/ui/src/bottom-sheet';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useAuth } from 'expo-app/features/auth/hooks/useAuth';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { useBottomSheetAction } from 'expo-app/lib/hooks/useBottomSheetAction';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { OnlineContentImportModal } from './OnlineContentImportModal';

type TemplateCreationOptionsProps = object;

export default React.forwardRef<BottomSheetModal, TemplateCreationOptionsProps>(
  function TemplateCreationOptions(_props, ref) {
    const { t } = useTranslation();
    const { colors } = useColorScheme();
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const user = useUser();
    const isAdmin = user?.role === 'ADMIN';
    const [showOnlineContentModal, setShowOnlineContentModal] = useState(false);

    const { run, handleDismiss } = useBottomSheetAction(ref as React.RefObject<BottomSheetModal>);

    const handleCreateFromScratch = () => {
      run(() => {
        router.push('/pack-templates/new');
      });
    };

    const handleImportFromOnlineContent = () => {
      run(() => {
        setShowOnlineContentModal(true);
      });
    };

    return (
      <>
        <Sheet
          ref={ref}
          enableDynamicSizing={true}
          enablePanDownToClose
          backgroundStyle={{ backgroundColor: colors.card }}
          onDismiss={handleDismiss}
        >
          <SheetView className="flex-1 px-4 pb-6" style={{ flex: 1 }}>
            <View className="mb-6">
              <Text className="text-lg font-semibold text-foreground mb-2">
                {t('packTemplates.createTemplate')}
              </Text>
              <Text className="text-sm text-muted-foreground leading-5" wrap>
                {t('packTemplates.chooseCreationMethod')}
              </Text>
            </View>

            {/* Create from scratch option */}
            <TouchableOpacity
              onPress={handleCreateFromScratch}
              className="mb-4 rounded-lg border border-border bg-card p-4 flex-row items-center"
            >
              <View className="mr-4 rounded-full bg-primary/10 p-3">
                <Icon name="plus" size={24} color={colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground mb-1">
                  {t('packTemplates.createFromScratch')}
                </Text>
                <Text className="text-sm text-muted-foreground" wrap>
                  {t('packTemplates.createFromScratchDescription')}
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.grey3} />
            </TouchableOpacity>

            {/* Import from TikTok option (only for admins) */}
            {isAdmin && isAuthenticated && (
              <TouchableOpacity
                onPress={handleImportFromOnlineContent}
                className="rounded-lg border border-border bg-card p-4 flex-row items-center"
              >
                <View className="mr-4 rounded-full bg-primary/10 p-3">
                  <Icon name="link" size={24} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground mb-1">
                    {t('packTemplates.importFromOnlineContent')}
                  </Text>
                  <Text className="text-sm text-muted-foreground" wrap>
                    {t('packTemplates.importFromOnlineContentDescription')}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.grey3} />
              </TouchableOpacity>
            )}
          </SheetView>
        </Sheet>

        <OnlineContentImportModal
          visible={showOnlineContentModal}
          onClose={() => setShowOnlineContentModal(false)}
        />
      </>
    );
  },
);
