import { useSpeedUnit } from 'expo-app/features/auth/hooks/useSpeedUnit';
import { distanceUnitFromSpeedUnit, type TripDistanceUnit } from '../utils/units';

/** Miles and feet for a user who reads wind in mph; kilometres and metres otherwise. */
export function useDistanceUnit(): TripDistanceUnit {
  const { unit } = useSpeedUnit();
  return distanceUnitFromSpeedUnit(unit);
}
