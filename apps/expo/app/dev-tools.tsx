import { DevToolsScreen, isDevToolsEnabled } from 'expo-app/features/dev-tools';
import { Redirect } from 'expo-router';

export default function DevToolsRoute() {
  if (!isDevToolsEnabled()) return <Redirect href="/" />;
  return <DevToolsScreen />;
}
