import { Platform } from 'react-native';

const IOS_SYSTEM_COLORS = {
  white: 'rgb(255, 255, 255)',
  black: 'rgb(0, 0, 0)',
  light: {
    grey6: 'rgb(242, 242, 247)',
    grey5: 'rgb(230, 230, 235)',
    grey4: 'rgb(210, 210, 215)',
    grey3: 'rgb(199, 199, 204)',
    grey2: 'rgb(175, 176, 180)',
    grey: 'rgb(142, 142, 147)',
    yellow: 'rgb(255, 111, 0)',
    green: 'rgb(144, 238, 144)',
    background: 'rgb(242, 242, 247)',
    foreground: 'rgb(0, 0, 0)',
    root: 'rgb(255, 255, 255)',
    card: 'rgb(255, 255, 255)',
    destructive: 'rgb(255, 56, 43)',
    primary: 'rgb(0, 123, 254)',
  },
  dark: {
    grey6: 'rgb(21, 21, 24)',
    grey5: 'rgb(40, 40, 42)',
    grey4: 'rgb(55, 55, 57)',
    grey3: 'rgb(70, 70, 73)',
    grey2: 'rgb(99, 99, 102)',
    grey: 'rgb(142, 142, 147)',
    yellow: 'rgb(255, 193, 7)',
    green: 'rgb(27, 94, 32)',
    background: 'rgb(0, 0, 0)',
    foreground: 'rgb(255, 255, 255)',
    root: 'rgb(0, 0, 0)',
    card: 'rgb(28, 28, 30)',
    destructive: 'rgb(254, 67, 54)',
    primary: 'rgb(3, 133, 255)',
  },
} as const;

// Material 3 scheme (SchemeFidelity, seed #0070E9); mirrors the --android-* tokens in global.css.
const ANDROID_COLORS = {
  white: 'rgb(255, 255, 255)',
  black: 'rgb(0, 0, 0)',
  light: {
    grey6: 'rgb(242, 243, 254)', // surfaceContainerLow
    grey5: 'rgb(224, 226, 236)', // surfaceContainerHighest
    grey4: 'rgb(193, 198, 214)', // outlineVariant
    grey3: 'rgb(114, 119, 133)', // outline
    grey2: 'rgb(65, 71, 84)', // onSurfaceVariant
    grey: 'rgb(65, 71, 84)', // onSurfaceVariant
    yellow: 'rgb(255, 111, 0)',
    green: 'rgb(27, 94, 32)',
    background: 'rgb(249, 249, 255)', // surface
    foreground: 'rgb(24, 28, 35)', // onSurface
    root: 'rgb(249, 249, 255)', // surface
    card: 'rgb(242, 243, 254)', // surfaceContainerLow
    destructive: 'rgb(186, 26, 26)', // error
    primary: 'rgb(0, 88, 186)', // primary
  },
  dark: {
    grey6: 'rgb(24, 28, 35)', // surfaceContainerLow
    grey5: 'rgb(50, 53, 61)', // surfaceContainerHighest
    grey4: 'rgb(65, 71, 84)', // outlineVariant
    grey3: 'rgb(139, 144, 160)', // outline
    grey2: 'rgb(193, 198, 214)', // onSurfaceVariant
    grey: 'rgb(193, 198, 214)', // onSurfaceVariant
    yellow: 'rgb(255, 193, 7)',
    green: 'rgb(144, 238, 144)',
    background: 'rgb(16, 19, 26)', // surface
    foreground: 'rgb(224, 226, 236)', // onSurface
    root: 'rgb(16, 19, 26)', // surface
    card: 'rgb(24, 28, 35)', // surfaceContainerLow
    destructive: 'rgb(255, 180, 171)', // error
    primary: 'rgb(173, 199, 255)', // primary
  },
} as const;

const COLORS = Platform.OS === 'ios' ? IOS_SYSTEM_COLORS : ANDROID_COLORS;

export { COLORS };
