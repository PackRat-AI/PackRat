import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  name: 'PackRat',
  slug: 'packrat',
  version: '2.0.0',
  scheme: 'packrat',
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png',
  },
  plugins: ['expo-router', 'expo-sqlite'],
  experiments: {
    typedRoutes: true,
    tsconfigPaths: true,
  },
  orientation: 'portrait',
  icon: './assets/packrat-app-icon-gradient.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.andrewbierman.packrat',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#026A9F',
    },
    package: 'com.packratai.mobile',
  },
  extra: {
    eas: {
      projectId: '267945b1-d9ac-4621-8541-826a2c70576d',
    },
  },
  updates: {
    url: 'https://u.expo.dev/267945b1-d9ac-4621-8541-826a2c70576d',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  owner: 'packrat',
});
