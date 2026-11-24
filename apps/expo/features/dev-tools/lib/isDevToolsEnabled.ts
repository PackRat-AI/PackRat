import Constants from 'expo-constants';

/**
 * Developer tools exist in dev and preview builds only, never in a Play Store
 * build. `appVariant` comes from the EAS profile via app.config.ts.
 */
export function isDevToolsEnabled(): boolean {
  if (__DEV__) return true;
  const variant = Constants.expoConfig?.extra?.appVariant as string | undefined;
  return variant !== undefined && variant !== 'production';
}
