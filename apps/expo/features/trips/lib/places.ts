import { clientEnvs } from '@packrat/env/expo-client';
import { fromZod } from '@packrat/guards';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { Linking } from 'react-native';
import { z } from 'zod';

const GOOGLE_MAPS_API_KEY: string | undefined =
  Constants.expoConfig?.extra?.googleMapsApiKey || clientEnvs.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export type Place = {
  /** The full address, e.g. "Yosemite Valley, California, USA". Saved as the trip's location name. */
  name: string;
  latitude: number;
  longitude: number;
};

export type Coords = { latitude: number; longitude: number };

/** "Yosemite Valley" and "California, USA" from "Yosemite Valley, California, USA". */
export function splitPlaceName(name: string): { title: string; region?: string } {
  const parts = name
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const [title = name, ...rest] = parts;
  return rest.length > 0 ? { title, region: rest.join(', ') } : { title };
}

const GeocodeResponseSchema = z.object({
  status: z.string(),
  results: z
    .array(
      z.object({
        formatted_address: z.string(),
        geometry: z.object({ location: z.object({ lat: z.number(), lng: z.number() }) }),
      }),
    )
    .optional(),
});

async function geocode({ params, action }: { params: string; action: string }): Promise<Place[]> {
  if (!GOOGLE_MAPS_API_KEY) throw new Error('Google Maps API key is not configured');
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params}&key=${GOOGLE_MAPS_API_KEY}`,
    );
    if (!response.ok) throw new Error(`Geocode request failed: ${response.status}`);
    const data = fromZod(GeocodeResponseSchema)(await response.json());
    if (!data) throw new Error('Geocode response was not in the expected shape');
    if (data.status === 'ZERO_RESULTS') return [];
    if (data.status !== 'OK') throw new Error(`Geocode status ${data.status}`);
    return (data.results ?? []).map((result) => ({
      name: result.formatted_address,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
    }));
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: 'tripLocation', action } });
    throw error;
  }
}

/** Places matching a typed query, best match first. */
export function searchPlaces(query: string): Promise<Place[]> {
  return geocode({ params: `address=${encodeURIComponent(query)}`, action: 'searchPlaces' });
}

/** The named place at a point on the map, or null when there is nothing there to name. */
export async function placeAt(coords: Coords): Promise<Place | null> {
  const [first] = await geocode({
    params: `latlng=${coords.latitude},${coords.longitude}`,
    action: 'placeAt',
  });
  return first ? { ...first, latitude: coords.latitude, longitude: coords.longitude } : null;
}

/** Where the phone is now, or null when location access is refused or unavailable. */
export async function currentCoords(): Promise<Coords | null> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) return null;
  const last = await Location.getLastKnownPositionAsync().catch(() => null);
  const position =
    last ??
    (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(
      () => null,
    ));
  return position
    ? { latitude: position.coords.latitude, longitude: position.coords.longitude }
    : null;
}

/** Opens the place in the phone's maps app, which offers directions from there. */
export async function openDirections(place: Coords & { name?: string }) {
  const { latitude, longitude } = place;
  const label = place.name ? `(${encodeURIComponent(splitPlaceName(place.name).title)})` : '';
  const geo = `geo:${latitude},${longitude}?q=${latitude},${longitude}${label}`;
  try {
    await Linking.openURL(geo);
  } catch {
    await Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    );
  }
}
