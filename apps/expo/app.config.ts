import { withSentry } from '@sentry/react-native/expo';
import type { ExpoConfig } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

const getAppName = () => {
  if (IS_DEV) return 'PackRat (Dev)';
  if (IS_PREVIEW) return 'PackRat (Preview)';
  return 'PackRat';
};

const getBundleIdentifier = () => {
  if (IS_DEV) return 'com.andrewbierman.packrat.dev';
  if (IS_PREVIEW) return 'com.andrewbierman.packrat.preview';
  return 'com.andrewbierman.packrat';
};

const getAndroidPackage = () => {
  if (IS_DEV) return 'com.packratai.mobile.dev';
  if (IS_PREVIEW) return 'com.packratai.mobile.preview';
  return 'com.packratai.mobile';
};

const getIcon = () => {
  if (IS_DEV) return './assets/packrat-app-icon-gradient-dev.png';
  return './assets/packrat-app-icon-gradient.png';
};

const getAdaptiveIcon = () => {
  if (IS_DEV) return './assets/adaptive-icon-dev.png';
  return './assets/adaptive-icon.png';
};

export default (): ExpoConfig =>
  withSentry(
    {
      name: getAppName(),
      slug: 'packrat',
      version: '2.0.14',
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
        'expo-localization',
      ],
      experiments: {
        typedRoutes: true,
        tsconfigPaths: true,
      },
      orientation: 'portrait',
      icon: getIcon(),
      userInterfaceStyle: 'automatic',
      splash: {
        image: './assets/splash.png',
      },
      assetBundlePatterns: ['**/*'],
      ios: {
        supportsTablet: true,
        bundleIdentifier: getBundleIdentifier(),
        usesAppleSignIn: true,
        config: {
          googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
        infoPlist: {
          ITSAppUsesNonExemptEncryption: false,
          CFBundleURLTypes: [
            {
              CFBundleURLSchemes: [getBundleIdentifier()],
            },
          ],
          NSLocationWhenInUseUsageDescription:
            'This app needs access to your location while you are using it.',
          NSCameraUsageDescription:
            'This app requires access to your camera to let you take photos or scan items.',
          NSPhotoLibraryUsageDescription:
            'This app needs access to your photo library to let you upload or choose photos.',
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
          foregroundImage: getAdaptiveIcon(),
          backgroundColor: '#026A9F',
        },
        package: getAndroidPackage(),
        config: {
          googleMaps: {
            apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
          },
        },
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
