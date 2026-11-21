import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { Button } from '@packrat/ui/src/button';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, TextInput, type TextInputInstance, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type Coords,
  currentCoords,
  type Place,
  placeAt,
  searchPlaces,
  splitPlaceName,
} from '../lib/places';
import { useTripLocation } from '../store/tripLocationStore';

const WORLD: Region = { latitude: 39.5, longitude: -98.35, latitudeDelta: 40, longitudeDelta: 40 };
const PLACE_DELTA = 0.05;
const SEARCH_DEBOUNCE_MS = 400;

type Pinned =
  | { status: 'idle' }
  | { status: 'loading'; coords: Coords }
  | { status: 'ready'; coords: Coords; place: Place | null };

type Search =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; results: Place[] }
  | { status: 'error' };

/**
 * Picks a trip's place: search at the top, a pin fixed at the centre of the map, and the place
 * under the pin confirmed from the panel at the bottom.
 */
export function LocationPickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const { location, setLocation } = useTripLocation();

  const mapRef = useRef<MapView>(null);
  const inputRef = useRef<TextInputInstance>(null);
  const alertRef = useRef<AlertMethods>(null);
  /** Set when the camera moves to a search result, so its known name is kept, not re-looked-up. */
  const knownPlace = useRef<Place | null>(null);
  const lookupId = useRef(0);

  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [search, setSearch] = useState<Search>({ status: 'idle' });
  const [moving, setMoving] = useState(false);
  const [pinned, setPinned] = useState<Pinned>(
    location
      ? {
          status: 'ready',
          coords: location,
          place: location.name ? { name: location.name, ...location } : null,
        }
      : { status: 'idle' },
  );

  const initialRegion: Region = location
    ? { ...location, latitudeDelta: PLACE_DELTA, longitudeDelta: PLACE_DELTA }
    : WORLD;

  // With no place yet, start where the user is when location access was already given.
  useEffect(() => {
    if (location) return;
    let cancelled = false;
    (async () => {
      const { granted } = await Location.getForegroundPermissionsAsync();
      if (!granted || cancelled) return;
      const coords = await currentCoords();
      if (coords && !cancelled) moveTo(coords);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Search as the user types, after a short pause.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSearch({ status: 'idle' });
      return;
    }
    setSearch({ status: 'loading' });
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await searchPlaces(trimmed);
        if (!cancelled) setSearch({ status: 'done', results: results.slice(0, 6) });
      } catch {
        if (!cancelled) setSearch({ status: 'error' });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const moveTo = (coords: Coords) => {
    mapRef.current?.animateToRegion(
      { ...coords, latitudeDelta: PLACE_DELTA, longitudeDelta: PLACE_DELTA },
      600,
    );
  };

  const pickResult = (place: Place) => {
    Keyboard.dismiss();
    inputRef.current?.blur();
    setQuery(splitPlaceName(place.name).title);
    setSearch({ status: 'idle' });
    knownPlace.current = place;
    setPinned({ status: 'ready', coords: place, place });
    moveTo(place);
  };

  const onRegionChangeComplete = async (region: Region) => {
    setMoving(false);
    const coords = { latitude: region.latitude, longitude: region.longitude };
    const known = knownPlace.current;
    if (known) {
      knownPlace.current = null;
      setPinned({ status: 'ready', coords, place: { ...known, ...coords } });
      return;
    }
    const id = ++lookupId.current;
    setPinned({ status: 'loading', coords });
    const place = await placeAt(coords).catch(() => null);
    if (id === lookupId.current) setPinned({ status: 'ready', coords, place });
  };

  const showMyLocation = async () => {
    const coords = await currentCoords();
    if (!coords) {
      alertRef.current?.alert({
        title: t('trips.map.locationOffTitle'),
        message: t('trips.map.locationOffMessage'),
        buttons: [{ text: t('common.ok') }],
      });
      return;
    }
    moveTo(coords);
  };

  const confirm = () => {
    if (pinned.status !== 'ready') return;
    setLocation({
      latitude: pinned.coords.latitude,
      longitude: pinned.coords.longitude,
      ...(pinned.place ? { name: pinned.place.name } : {}),
    });
    router.back();
  };

  const pinStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: withSpring(moving ? -12 : 0, { damping: 14 }) }],
  }));

  const showResults = searchFocused && search.status !== 'idle';
  const label = pinnedLabel(pinned, t);

  return (
    <View className="flex-1 bg-background" testID={testIds.trips.locationPickerScreen}>
      <View className="flex-1">
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}
          mapPadding={{ top: insets.top + 72, right: 0, bottom: 24, left: 0 }}
          onRegionChange={() => !moving && setMoving(true)}
          onRegionChangeComplete={onRegionChangeComplete}
          onPanDrag={() => searchFocused && inputRef.current?.blur()}
        />

        {/* The fixed pin. Its tip marks the centre of the map's visible area. */}
        <View
          pointerEvents="none"
          className="absolute inset-x-0 items-center"
          style={{ top: insets.top + 72, bottom: 24, justifyContent: 'center' }}
        >
          <Animated.View style={[{ marginBottom: 44 }, pinStyle]}>
            <Icon name="map-marker" size={48} color={colors.destructive} />
          </Animated.View>
          <View
            className="absolute h-2 w-2 rounded-full"
            style={{ backgroundColor: colors.foreground, opacity: moving ? 0.35 : 0.2 }}
          />
        </View>

        {/* Search bar */}
        <View className="absolute inset-x-4" style={{ top: insets.top + 8 }}>
          <View
            className="h-14 flex-row items-center rounded-full bg-card pl-1 pr-2"
            style={{ elevation: 3 }}
          >
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              testID={testIds.trips.locationPickerBack}
              android_ripple={{ color: colors.grey4, borderless: true, radius: 22 }}
              className="h-12 w-12 items-center justify-center"
            >
              <Icon name="arrow-left" size={24} color={colors.foreground} />
            </Pressable>
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={t('location.searchForPlace')}
              placeholderTextColor={colors.grey}
              returnKeyType="search"
              autoCorrect={false}
              testID={testIds.trips.locationPickerSearch}
              className="flex-1 px-2 text-base"
              style={{ color: colors.foreground }}
            />
            {search.status === 'loading' ? (
              <View className="h-12 w-12 items-center justify-center">
                <ActivityIndicator size="small" />
              </View>
            ) : query.length > 0 ? (
              <Pressable
                onPress={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                accessibilityRole="button"
                accessibilityLabel={t('common.clear')}
                testID={testIds.trips.locationPickerClear}
                android_ripple={{ color: colors.grey4, borderless: true, radius: 22 }}
                className="h-12 w-12 items-center justify-center"
              >
                <Icon name="close" size={22} color={colors.grey} />
              </Pressable>
            ) : null}
          </View>

          {showResults ? (
            <View
              className="mt-2 overflow-hidden rounded-3xl bg-card py-2"
              style={{ elevation: 3 }}
            >
              {search.status === 'error' ? (
                <Text variant="subhead" className="px-5 py-3 text-muted-foreground">
                  {t('trips.locationPicker.searchFailed')}
                </Text>
              ) : search.status === 'done' && search.results.length === 0 ? (
                <Text variant="subhead" className="px-5 py-3 text-muted-foreground">
                  {t('trips.locationPicker.noResults')}
                </Text>
              ) : search.status === 'done' ? (
                search.results.map((place, index) => {
                  const { title, region } = splitPlaceName(place.name);
                  return (
                    <Pressable
                      key={`${place.latitude},${place.longitude},${place.name}`}
                      onPress={() => pickResult(place)}
                      testID={testIds.trips.locationPickerResult(index)}
                      android_ripple={{ color: colors.grey4 }}
                      className="flex-row items-center gap-4 px-5 py-3"
                    >
                      <Icon name="map-marker-outline" size={24} color={colors.grey} />
                      <View className="flex-1">
                        <Text variant="body" numberOfLines={1}>
                          {title}
                        </Text>
                        {region ? (
                          <Text
                            variant="footnote"
                            className="text-muted-foreground"
                            numberOfLines={1}
                          >
                            {region}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Current location */}
        <Pressable
          onPress={showMyLocation}
          accessibilityRole="button"
          accessibilityLabel={t('trips.map.myLocation')}
          testID={testIds.trips.locationPickerMyLocation}
          android_ripple={{ color: colors.grey4 }}
          className="absolute bottom-10 right-4 h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-card"
          style={{ elevation: 4 }}
        >
          <Icon name="crosshairs-gps" size={24} color={colors.primary} />
        </Pressable>
      </View>

      {/* Confirm panel */}
      <View
        className="-mt-6 gap-4 rounded-t-3xl bg-card px-5 pt-5"
        style={{ paddingBottom: insets.bottom + 16, elevation: 8 }}
      >
        <View className="flex-row items-center gap-4">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Icon name="map-marker" size={22} color={colors.destructive} />
          </View>
          <View className="flex-1">
            {pinned.status === 'loading' ? (
              <Text variant="heading" className="text-muted-foreground">
                {t('trips.locationPicker.finding')}
              </Text>
            ) : (
              <Text variant="heading" numberOfLines={1}>
                {label.title}
              </Text>
            )}
            {label.region ? (
              <Text variant="subhead" className="text-muted-foreground" numberOfLines={1}>
                {label.region}
              </Text>
            ) : null}
          </View>
        </View>
        <Button
          onPress={confirm}
          disabled={pinned.status !== 'ready'}
          testID={testIds.trips.locationPickerConfirm}
        >
          <Text>{t('trips.locationPicker.useThisLocation')}</Text>
        </Button>
      </View>

      <Alert title="" buttons={[]} ref={alertRef} />
    </View>
  );
}

function pinnedLabel(
  pinned: Pinned,
  t: ReturnType<typeof useTranslation>['t'],
): { title: string; region?: string } {
  if (pinned.status === 'idle') return { title: t('trips.locationPicker.moveMap') };
  const coordsText = `${pinned.coords.latitude.toFixed(4)}, ${pinned.coords.longitude.toFixed(4)}`;
  if (pinned.status === 'loading') return { title: '', region: coordsText };
  if (!pinned.place) return { title: t('trips.locationPicker.droppedPin'), region: coordsText };
  return splitPlaceName(pinned.place.name);
}
