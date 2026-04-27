import { Ionicons } from '@expo/vector-icons';
import { Text } from '@packrat/ui/nativewindui';
import { useTranslation } from 'app/lib/hooks/useTranslation';
import { decodeHtmlEntities } from 'app/lib/utils/decodeHtmlEntities';
import { ScrollView, TouchableOpacity, View } from 'react-native';

export function CategoriesFilter({
  activeFilter,
  onFilter,
  data,
  error,
  retry,
  className,
}: {
  activeFilter: string;
  onFilter: (filter: string) => void;
  data: string[] | undefined;
  error?: Error | null;
  retry?: (() => void) | undefined;
  className?: string;
}) {
  const { t } = useTranslation();

  const renderFilterChip = (filter: string) => (
    <TouchableOpacity
      key={filter}
      onPress={() => onFilter(filter)}
      className={`mr-2 rounded-full px-4 py-2 ${activeFilter === filter ? 'bg-primary' : 'bg-card'}`}
    >
      <Text
        className={`text-sm font-medium ${
          activeFilter === filter ? 'text-primary-foreground' : 'text-foreground'
        }`}
      >
        {decodeHtmlEntities(filter)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View className={className}>
      {error ? (
        <View className="rounded-lg bg-destructive/10 dark:bg-destructive/20 p-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text className="text-sm text-destructive">{t('catalog.failedToLoad')}</Text>
            </View>
            {retry && (
              <TouchableOpacity
                onPress={retry}
                className="ml-2 rounded px-2 py-1 bg-destructive/20"
              >
                <Text className="text-xs text-destructive font-medium">{t('common.retry')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
          {!data
            ? Array.from({ length: 10 }).map((_, i) => (
                <View
                  key={i}
                  className="h-8 w-20 rounded-full mr-2 bg-neutral-300 dark:bg-neutral-600"
                />
              ))
            : data.map(renderFilterChip)}
        </ScrollView>
      )}
    </View>
  );
}
