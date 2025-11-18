import { useActionSheet } from '@expo/react-native-action-sheet';
import { Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { appAlert } from 'expo-app/app/_layout';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { Pressable, TouchableWithoutFeedback, View } from 'react-native';
import { useDeletePackTemplateItem } from '../hooks';
import type { PackTemplateItem } from '../types';
import { PackTemplateItemImage } from './PackTemplateItemImage';

type PackTemplateItemCardProps = {
  item: PackTemplateItem;
  belongsToAppTemplate: boolean;
  onPress: (item: PackTemplateItem) => void;
};

export function PackTemplateItemCard({
  item,
  onPress,
  belongsToAppTemplate,
}: PackTemplateItemCardProps) {
  const router = useRouter();
  const deleteItem = useDeletePackTemplateItem();
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const user = useUser();

  const { showActionSheetWithOptions } = useActionSheet();

  const handleActionsPress = () => {
    const options =
      belongsToAppTemplate && user?.role !== 'ADMIN'
        ? [t('packTemplates.viewDetails'), t('common.cancel')]
        : [t('packTemplates.viewDetails'), t('common.edit'), t('common.delete'), t('common.cancel')];

    const cancelButtonIndex = options.length - 1;
    const destructiveButtonIndex = options.indexOf(t('common.delete'));
    const viewDetailsIndex = 0;
    const editIndex = options.indexOf(t('common.edit'));

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        destructiveButtonIndex,
        title: item.name,
        message: item.description,
        containerStyle: {
          backgroundColor: colors.card,
        },
        textStyle: {
          color: colors.foreground,
        },
        titleTextStyle: {
          color: colors.foreground,
          fontWeight: '600',
        },
        messageTextStyle: {
          color: colors.grey2,
        },
      },
      (selectedIndex) => {
        switch (selectedIndex) {
          case viewDetailsIndex:
            onPress(item);
            break;
          case editIndex:
            router.push({
              pathname: '/templateItem/[id]/edit',
              params: { id: item.id, packTemplateId: item.packTemplateId },
            });
            break;
          case destructiveButtonIndex:
            appAlert.current?.alert({
              title: t('packTemplates.deleteItem'),
              message: t('packTemplates.deleteItemMessage'),
              buttons: [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.ok'), onPress: () => deleteItem(item.id) },
              ],
            });
            break;
        }
      },
    );
  };

  return (
    <>
      <TouchableWithoutFeedback key={item.id} onPress={() => onPress(item)}>
        <View className="rounded-lg flex-row gap-3 border p-4 border-border bg-card">
          {/* Image */}
          <PackTemplateItemImage item={item} className="h-16 w-16 rounded-md" resizeMode="cover" />

          {/* Content */}
          <View className="flex-1">
            <View className="flex-row gap-2 justify-between items-start">
              <Text className="flex-1 font-medium text-foreground" numberOfLines={2}>
                {item.name}
              </Text>
              <Pressable onPress={handleActionsPress}>
                <Icon name="dots-horizontal" size={20} color={colors.grey2} />
              </Pressable>
            </View>
            <Text className="text-sm text-muted-foreground mb-2">{item.category}</Text>

            <View className="flex-row items-center gap-4 flex-wrap">
              {item.consumable && (
                <View className={cn('rounded-full px-2 py-0.5', 'bg-amber-100')}>
                  <Text className={cn('text-xs', 'text-amber-600')}>{t('packTemplates.consumable')}</Text>
                </View>
              )}

              {item.worn && (
                <View className={cn('rounded-full px-2 py-0.5', 'bg-emerald-100')}>
                  <Text className={cn('text-xs', 'text-emerald-600')}>{t('packTemplates.worn')}</Text>
                </View>
              )}
            </View>
            <View className="mt-2 flex-row items-center gap-4 flex-wrap">
              <Text className="text-sm font-medium text-foreground">
                {item.weight}
                {item.weightUnit}
              </Text>

              <Text className="text-sm text-muted-foreground">{item.quantity} {t('packTemplates.qty')}</Text>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </>
  );
}
