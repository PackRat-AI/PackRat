// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro'); // ensures unique Debug IDs get assigned to the generated bundles and source maps uploaded to Sentry [read more](https://docs.sentry.io/platforms/react-native/manual-setup/expo/#add-sentry-metro-plugin)
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
// eslint-disable-next-line no-undef
const config = getSentryExpoConfig(__dirname);

/**
 * Web platform stubs for native-only modules.
 * When Metro builds for web it will resolve these to safe no-op stubs instead
 * of failing to find the underlying native binaries.
 */
const WEB_MODULE_STUBS = {
  'react-native-maps': path.resolve(__dirname, 'web-stubs/react-native-maps.js'),
  'llama.rn': path.resolve(__dirname, 'web-stubs/llama.rn.js'),
  'react-native-ios-context-menu': path.resolve(
    __dirname,
    'web-stubs/react-native-ios-context-menu.js',
  ),
  'react-native-ios-utilities': path.resolve(
    __dirname,
    'web-stubs/react-native-ios-utilities.js',
  ),
};

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_MODULE_STUBS[moduleName]) {
    return { type: 'sourceFile', filePath: WEB_MODULE_STUBS[moduleName] };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
