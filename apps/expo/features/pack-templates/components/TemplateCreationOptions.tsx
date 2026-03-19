import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { Sheet, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useAuth } from 'expo-app/features/auth/hooks/useAuth';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { useBottomSheetAction } from 'expo-app/lib/hooks/useBottomSheetAction';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TikTokImportModal } from './TikTokImportModal';

type TemplateCreationOptionsProps = object;

export default React.forwardRef<BottomSheetModal, TemplateCreationOptionsProps>(
  // biome-ignore lint/complexity/useMaxParams: existing code - migrate to single typed object parameter
  function TemplateCreationOptions(_props, ref) {
    const { t } = useTranslation();
    const { colors } = useColorScheme();
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const user = useUser();
    const isAdmin = user?.role === 'ADMIN';
    const [showTikTokModal, setShowTikTokModal] = useState(false);
    const insets = useSafeAreaInsets();

    const { run, handleDismiss } = useBottomSheetAction(ref as React.RefObject<BottomSheetModal>);

    const handleCreateFromScratch = () => {
      run(() => {
        router.push('/pack-templates/new');
      });
    };

    const handleImportFromTikTok = () => {
      run(() => {
        setShowTikTokModal(true);
      });
    };

    return (
      <>
        <Sheet
          ref={ref}
          enableDynamicSizing={true}
          enablePanDownToClose
          bottomInset={insets.bottom}
          backgroundStyle={{ backgroundColor: colors.card }}
          handleIndicatorStyle={{ backgroundColor: colors.grey2 }}
          onDismiss={handleDismiss}
        >
          <BottomSheetView className="flex-1 px-4 pb-6" style={{ flex: 1 }}>
            <View className="mb-6">
              <Text className="text-lg font-semibold text-foreground mb-2">
                {t('packTemplates.createTemplate')}
              </Text>
              <Text className="text-sm text-muted-foreground leading-5">
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
                <Text className="text-sm text-muted-foreground">
                  {t('packTemplates.createFromScratchDescription')}
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color={colors.grey3} />
            </TouchableOpacity>

            {/* Import from TikTok option (only for admins) */}
            {isAdmin && isAuthenticated && (
              <TouchableOpacity
                onPress={handleImportFromTikTok}
                className="rounded-lg border border-border bg-card p-4 flex-row items-center"
              >
                <View className="mr-4 rounded-full bg-primary/10 p-3">
                  <Icon name="link" size={24} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground mb-1">
                    {t('packTemplates.importFromTikTok')}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {t('packTemplates.importFromTikTokDescription')}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.grey3} />
              </TouchableOpacity>
            )}
          </BottomSheetView>
        </Sheet>

        {/* TikTok Import Modal */}
        <TikTokImportModal visible={showTikTokModal} onClose={() => setShowTikTokModal(false)} />
      </>
    );
  },
);
