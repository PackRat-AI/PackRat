// Geographic center of the contiguous US — used as fallback when geolocation is denied
export const DEFAULT_CENTER: [number, number] = [39.5, -98.35];
export const DEFAULT_ZOOM = 5;
export const NEARBY_ZOOM = 11;

export function getUserLocation(): Promise<[number, number] | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
      () => resolve(null),
      { timeout: 8000, maximumAge: 300_000 },
    );
  });
}
