// @react-native-google-signin/google-signin is a native module with no usable
// web implementation. Native Google Sign-In is not wired up for web (web auth
// uses a different OAuth flow), so this stub keeps the bundle building and
// fails loudly only if a web caller actually tries to trigger native sign-in.

const notAvailable = (): never => {
  throw new Error('Native Google Sign-In is not available on web.');
};

export const GoogleSignin = {
  configure: () => {},
  hasPlayServices: () => Promise.resolve(false),
  signIn: notAvailable,
  signInSilently: notAvailable,
  getTokens: notAvailable,
  hasPreviousSignIn: () => false,
  signOut: () => Promise.resolve(null),
  revokeAccess: () => Promise.resolve(null),
  getCurrentUser: () => null,
};

export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
} as const;

export const isErrorWithCode = (_error: unknown): boolean => false;
export const isSuccessResponse = (_response: unknown): boolean => false;
export const isCancelledResponse = (_response: unknown): boolean => false;
export const isNoSavedCredentialFoundResponse = (_response: unknown): boolean => false;

export const GoogleSigninButton = (): null => null;
