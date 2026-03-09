import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GPSPosition, Waypoint } from '../types';

/**
 * Hook for GPS tracking and waypoint management.
 * Uses expo-location for on-device GPS (no internet required).
 */
export function useGPSTracking() {
  const [isTracking, setIsTracking] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<GPSPosition | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      setPermissionGranted(status === 'granted');
    });
  }, []);

  const startTracking = useCallback(async () => {
    if (!permissionGranted) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return false;
      setPermissionGranted(true);
    }

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000,
        distanceInterval: 10,
      },
      (location) => {
        setCurrentPosition({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude: location.coords.altitude,
          accuracy: location.coords.accuracy,
          speed: location.coords.speed,
          heading: location.coords.heading,
          timestamp: location.timestamp,
        });
      },
    );

    watchRef.current = subscription;
    setIsTracking(true);
    return true;
  }, [permissionGranted]);

  const stopTracking = useCallback(() => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const getCurrentPosition = useCallback(async (): Promise<GPSPosition | null> => {
    if (!permissionGranted) return null;
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const pos: GPSPosition = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude,
        accuracy: location.coords.accuracy,
        speed: location.coords.speed,
        heading: location.coords.heading,
        timestamp: location.timestamp,
      };
      setCurrentPosition(pos);
      return pos;
    } catch {
      return null;
    }
  }, [permissionGranted]);

  const markWaypoint = useCallback(
    async (name?: string): Promise<Waypoint | null> => {
      const pos = currentPosition ?? (await getCurrentPosition());
      if (!pos) return null;

      const waypoint: Waypoint = {
        id: `wp_${Date.now()}`,
        name: name ?? `Waypoint ${waypoints.length + 1}`,
        latitude: pos.latitude,
        longitude: pos.longitude,
        createdAt: new Date().toISOString(),
      };

      setWaypoints((prev) => [...prev, waypoint]);
      return waypoint;
    },
    [currentPosition, getCurrentPosition, waypoints.length],
  );

  const getDistanceTo = useCallback(
    (target: { latitude: number; longitude: number }): number | null => {
      if (!currentPosition) return null;
      const R = 6371e3; // metres
      const φ1 = (currentPosition.latitude * Math.PI) / 180;
      const φ2 = (target.latitude * Math.PI) / 180;
      const Δφ = ((target.latitude - currentPosition.latitude) * Math.PI) / 180;
      const Δλ = ((target.longitude - currentPosition.longitude) * Math.PI) / 180;
      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    },
    [currentPosition],
  );

  useEffect(() => {
    return () => {
      if (watchRef.current) {
        watchRef.current.remove();
      }
    };
  }, []);

  return {
    isTracking,
    currentPosition,
    waypoints,
    permissionGranted,
    startTracking,
    stopTracking,
    getCurrentPosition,
    markWaypoint,
    getDistanceTo,
  };
}
