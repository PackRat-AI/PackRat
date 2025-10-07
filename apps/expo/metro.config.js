// Learn more https://docs.expo.io/guides/customizing-metro
const { getSentryExpoConfig } = require('@sentry/react-native/metro'); // ensures unique Debug IDs get assigned to the generated bundles and source maps uploaded to Sentry [read more](https://docs.sentry.io/platforms/react-native/manual-setup/expo/#add-sentry-metro-plugin)
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
// eslint-disable-next-line no-undef
const config = getSentryExpoConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
