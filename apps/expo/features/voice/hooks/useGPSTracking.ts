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
  // Prevents concurrent permission requests racing each other (#12)
  const permissionRequestInFlightRef = useRef(false);
  // Stable counter for auto-generated waypoint names — avoids waypoints.length dep
  const waypointCountRef = useRef(0);

  useEffect(() => {
    if (permissionRequestInFlightRef.current) return;
    permissionRequestInFlightRef.current = true;
    Location.requestForegroundPermissionsAsync()
      .then(({ status }) => {
        setPermissionGranted(status === 'granted');
      })
      .finally(() => {
        permissionRequestInFlightRef.current = false;
      });
  }, []);

  const startTracking = useCallback(async () => {
    // Guard: prevent creating a second subscription while already tracking (#3).
    // Return true because tracking is already active — the caller's intent is satisfied.
    if (watchRef.current) return true;

    if (!permissionGranted) {
      if (permissionRequestInFlightRef.current) return false;
      permissionRequestInFlightRef.current = true;
      const { status } = await Location.requestForegroundPermissionsAsync();
      permissionRequestInFlightRef.current = false;
      if (status !== 'granted') return false;
      setPermissionGranted(true);
    }

    try {
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
    } catch (err) {
      console.warn('[useGPSTracking] watchPositionAsync failed:', err);
      return false;
    }
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

      // Increment counter via ref so we don't need waypoints.length in deps (#6)
      waypointCountRef.current += 1;
      const waypoint: Waypoint = {
        id: `wp_${Date.now()}`,
        name: name ?? `Waypoint ${waypointCountRef.current}`,
        latitude: pos.latitude,
        longitude: pos.longitude,
        createdAt: new Date().toISOString(),
      };
      setWaypoints((prev) => [...prev, waypoint]);
      return waypoint;
    },
    [currentPosition, getCurrentPosition],
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
