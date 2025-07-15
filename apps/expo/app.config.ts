import { withSentry } from '@sentry/react-native/expo';
import type { ExpoConfig } from 'expo/config';

export default (): ExpoConfig =>
  withSentry(
    {
      name: 'PackRat',
      slug: 'packrat',
      version: '2.0.1',
      scheme: 'packrat',
      web: {
        bundler: 'metro',
        output: 'static',
        favicon: './assets/favicon.png',
      },
      plugins: [
        'expo-router',
        'expo-sqlite',
        [
          '@react-native-google-signin/google-signin',
          {
            iosUrlScheme:
              'com.googleusercontent.apps.993694750638-97t0vhfml04u2avrlbve22jbs9qcinbc',
          },
        ],
        'expo-secure-store',
        'expo-web-browser',
        'expo-apple-authentication',
      ],
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
        usesAppleSignIn: true,
        infoPlist: {
          ITSAppUsesNonExemptEncryption: false,
          CFBundleURLTypes: [
            {
              CFBundleURLSchemes: ['com.andrewbierman.packrat'],
            },
          ],
        },
        privacyManifests: {
          NSPrivacyCollectedDataTypes: [
            {
              NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCrashData',
              NSPrivacyCollectedDataTypeLinked: false,
              NSPrivacyCollectedDataTypeTracking: false,
              NSPrivacyCollectedDataTypePurposes: [
                'NSPrivacyCollectedDataTypePurposeAppFunctionality',
              ],
            },
            {
              NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePerformanceData',
              NSPrivacyCollectedDataTypeLinked: false,
              NSPrivacyCollectedDataTypeTracking: false,
              NSPrivacyCollectedDataTypePurposes: [
                'NSPrivacyCollectedDataTypePurposeAppFunctionality',
              ],
            },
            {
              NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherDiagnosticData',
              NSPrivacyCollectedDataTypeLinked: false,
              NSPrivacyCollectedDataTypeTracking: false,
              NSPrivacyCollectedDataTypePurposes: [
                'NSPrivacyCollectedDataTypePurposeAppFunctionality',
              ],
            },
          ],
          NSPrivacyAccessedAPITypes: [
            {
              NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
              NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
            },
            {
              NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
              NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
            },
            {
              NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
              NSPrivacyAccessedAPITypeReasons: ['C617.1'],
            },
          ],
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
    },
    {
      url: 'https://sentry.io/',
      organization: 'packrat-oq',
      project: 'packrat-expo',
    },
  );
