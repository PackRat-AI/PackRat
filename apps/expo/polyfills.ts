import 'react-native-get-random-values';
import structuredClone from '@ungap/structured-clone';
import { BackHandler, Platform } from 'react-native';

// RNW's BackHandler stub logs an error on every addEventListener call.
// expo-router calls it internally on every screen mount, flooding the console.
// Patch it to a silent no-op on web so the error never surfaces.
if (Platform.OS === 'web') {
  const noop = () => ({ remove: () => {} });
  BackHandler.addEventListener = noop;
  // removeEventListener exists on the RNW stub but was removed from RN typings
  (BackHandler as unknown as { removeEventListener: () => void }).removeEventListener = () => {};
  BackHandler.exitApp = () => {};
}

if (Platform.OS !== 'web') {
  const setupPolyfills = async () => {
    const { polyfillGlobal } = await import('react-native/Libraries/Utilities/PolyfillFunctions');

    const { TextEncoderStream, TextDecoderStream } = await import(
      '@stardazed/streams-text-encoding'
    );

    if (!('structuredClone' in global)) {
      polyfillGlobal('structuredClone', () => structuredClone);
    }

    polyfillGlobal('TextEncoderStream', () => TextEncoderStream);
    polyfillGlobal('TextDecoderStream', () => TextDecoderStream);
  };

  setupPolyfills();
}
