// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('node:path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro'); // ensures unique Debug IDs get assigned to the generated bundles and source maps uploaded to Sentry [read more](https://docs.sentry.io/platforms/react-native/manual-setup/expo/#add-sentry-metro-native-setup)
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
// eslint-disable-next-line no-undef
const config = getSentryExpoConfig(__dirname);

config.resolver = {
  ...config.resolver,
  assetExts: [...(config.resolver?.assetExts ?? []), 'wasm'],
  blockList: /node_modules\/.*\/android\/\.cxx\/.*/,
  // Enable package.json "exports" field resolution so workspace packages with
  // subpath exports (e.g. @packrat/schemas/constants) resolve correctly.
  unstable_enablePackageExports: true,
  // Exclude the ESM "import" condition so packages like Jotai resolve to their
  // CJS builds instead of .mjs files that contain import.meta (invalid in
  // Metro's __d() CJS module wrapper).
  unstable_conditionNames: ['require', 'default', 'react-native', 'browser'],
};

// Native-only packages that need web shims.
// Add new entries here when a package crashes on web.
const WEB_STUBS = {
  'react-native-maps': 'mocks/react-native-maps.tsx',
  'react-native-blob-util': 'mocks/react-native-blob-util.ts',
  '@react-native-ai/llama': 'mocks/react-native-ai-llama.ts',
  'llama.rn': 'mocks/react-native-ai-llama.ts',
  '@react-native-ai/apple': 'mocks/react-native-ai-apple.ts',
  '@react-native-google-signin/google-signin': 'mocks/react-native-google-signin.ts',
  'expo-sqlite/kv-store': 'mocks/expo-sqlite-kv-store.ts',
  // Required by lib/persist-plugin.web.ts (ObservablePersistAsyncStorage)
  '@react-native-async-storage/async-storage': 'mocks/async-storage.ts',
  // Keyboard utilities — on web the software keyboard doesn't overlay content
  'react-native-keyboard-controller': 'mocks/react-native-keyboard-controller.tsx',
  '@react-native-community/datetimepicker': 'mocks/react-native-community-datetimepicker.tsx',
  // expo-file-system throws UnavailabilityError on web; stub all ops as no-ops
  'expo-file-system/legacy': 'mocks/expo-file-system-legacy.ts',
};

const originalResolveRequest = config.resolver?.resolveRequest;
config.resolver = {
  ...config.resolver,
  // biome-ignore lint/complexity/useMaxParams: Metro resolveRequest requires exactly 3 params
  resolveRequest: (context, moduleName, platform) => {
    if (platform === 'web' && WEB_STUBS[moduleName]) {
      return {
        filePath: path.join(__dirname, WEB_STUBS[moduleName]),
        type: 'sourceFile',
      };
    }
    if (originalResolveRequest) return originalResolveRequest(context, moduleName, platform);
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = withNativeWind(config, {
  input: './global.css',
  inlineRem: 16,
});
