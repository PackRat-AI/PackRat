import { EmergencyContactsScreen } from 'expo-app/features/safety-check-in';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { Redirect } from 'expo-router';

export default function EmergencyContactsRoute() {
  const enableSafetyCheckIn = useFeatureFlag('enableSafetyCheckIn');
  if (!enableSafetyCheckIn) return <Redirect href="/" />;
  return <EmergencyContactsScreen />;
}
