import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { clientEnvs } from '@packrat/env/expo-client';
import { isString, toRecordArray } from '@packrat/guards';
import { Sheet, Text } from '@packrat/ui/nativewindui';
import * as Sentry from '@sentry/react-native';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import Constants from 'expo-constants';
import * as React from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GOOGLE_MAPS_API_KEY =
  Constants.expoConfig?.extra?.googleMapsApiKey || clientEnvs.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

interface GeocodingResult {
  place_id: string;
  formatted_address: string;
}

interface LocationSearchSheetProps {
  onBack: () => void;
  onLocationSelected: (location: string) => void;
  onDismiss?: () => void;
}

export const LocationSearchSheet = React.forwardRef<BottomSheetModal, LocationSearchSheetProps>(
  function LocationSearchSheet({ onBack, onLocationSelected, onDismiss }, ref) {
    const { colors } = useColorScheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [query, setQuery] = React.useState('');
    const [results, setResults] = React.useState<GeocodingResult[]>([]);
    const [isSearching, setIsSearching] = React.useState(false);

    React.useEffect(() => {
      if (query.trim().length < 2) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      const timer = setTimeout(async () => {
        try {
          if (!GOOGLE_MAPS_API_KEY) {
            setResults([{ place_id: 'custom', formatted_address: query.trim() }]);
            return;
          }

          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query.trim())}&key=${GOOGLE_MAPS_API_KEY}`,
          );
          const data = await response.json();

          if (data.status === 'OK') {
            const parsed = toRecordArray(data.results)
              .slice(0, 5)
              .map((r) => ({
                place_id: isString(r.place_id) ? r.place_id : '',
                formatted_address: isString(r.formatted_address) ? r.formatted_address : '',
              }))
              .filter((r) => r.place_id && r.formatted_address);
            setResults(parsed);
          } else {
            setResults([]);
          }
        } catch (err) {
          Sentry.captureException(err, {
            tags: { feature: 'seasons', action: 'locationSearch' },
          });
          setResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 400);

      return () => clearTimeout(timer);
    }, [query]);

    const handleBack = () => {
      setQuery('');
      setResults([]);
      onBack();
    };

    const handleSelect = (formattedAddress: string) => {
      setQuery('');
      setResults([]);
      onLocationSelected(formattedAddress);
    };

    const getShortName = (address: string) => address.split(',')[0] ?? address;
    const getSubtitle = (address: string) => {
      const parts = address.split(',');
      return parts.length > 1 ? parts.slice(1).join(',').trim() : '';
    };

    return (
      <Sheet
        ref={ref}
        snapPoints={['85%']}
        index={0}
        enablePanDownToClose
        topInset={insets.top}
        onDismiss={onDismiss}
        backgroundStyle={{ backgroundColor: colors.card }}
        handleIndicatorStyle={{ backgroundColor: colors.grey2 }}
      >
        {/* Fixed header */}
        <View>
          <View className="flex-row items-center border-b border-border px-2 py-3">
            <TouchableOpacity
              className="flex-row items-center gap-0.5 px-3 py-1"
              onPress={handleBack}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon
                namingScheme="sfSymbol"
                name="chevron.left"
                materialIcon={{ type: 'MaterialIcons', name: 'chevron-left' }}
                size={18}
                color={colors.primary}
              />
              <Text className="text-base text-primary">{t('common.back')}</Text>
            </TouchableOpacity>

            <View className="flex-1 items-center">
              <Text variant="heading" className="font-semibold">
                {t('seasons.searchLocationTitle')}
              </Text>
            </View>

            {/* Mirror spacer for back button to keep title centered */}
            <View className="w-20" />
          </View>

          {/* Search input */}
          <View className="px-4 pb-2 pt-3">
            <View
              className="flex-row items-center gap-2 rounded-xl px-3"
              style={{ backgroundColor: colors.grey6 }}
            >
              <Icon
                namingScheme="sfSymbol"
                name="magnifyingglass"
                materialIcon={{ type: 'MaterialIcons', name: 'search' }}
                size={16}
                color={colors.grey}
              />
              <BottomSheetTextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder={t('seasons.searchLocationPlaceholder')}
                placeholderTextColor={colors.grey}
                returnKeyType="search"
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  fontSize: 16,
                  color: colors.foreground,
                }}
              />
              {isSearching && <ActivityIndicator size="small" color={colors.grey} />}
            </View>
          </View>
        </View>

        {/* Scrollable results */}
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
          {query.trim().length >= 2 && !isSearching && results.length === 0 && (
            <View className="items-center py-12">
              <Text className="text-muted-foreground">{t('seasons.noLocationsFound')}</Text>
            </View>
          )}

          {results.map((result) => (
            <TouchableOpacity
              key={result.place_id}
              className="flex-row items-center gap-3 border-b border-border px-4 py-3.5"
              onPress={() => handleSelect(result.formatted_address)}
              activeOpacity={0.7}
            >
              <View
                className="h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.grey5 }}
              >
                <Icon
                  namingScheme="sfSymbol"
                  name="location.fill"
                  materialIcon={{ type: 'MaterialIcons', name: 'location-on' }}
                  size={15}
                  color={colors.grey2}
                />
              </View>
              <View className="flex-1">
                <Text variant="callout" className="font-medium" numberOfLines={1}>
                  {getShortName(result.formatted_address)}
                </Text>
                {getSubtitle(result.formatted_address) ? (
                  <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
                    {getSubtitle(result.formatted_address)}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </BottomSheetScrollView>
      </Sheet>
    );
  },
);
