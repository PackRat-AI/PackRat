// Web stub: Google Sign-In is a native-only SDK. On web, sign-in throws immediately.
export const GoogleSignin = {
  hasPlayServices: (): Promise<boolean> => Promise.resolve(true),
  signIn: (): Promise<never> =>
    Promise.reject(new Error('Google Sign-In is not supported on web. Please use email/password.')),
  getTokens: (): Promise<{ idToken: string | null; accessToken: string | null }> =>
    Promise.resolve({ idToken: null, accessToken: null }),
  hasPreviousSignIn: (): Promise<boolean> => Promise.resolve(false),
  signOut: (): Promise<void> => Promise.resolve(),
  configure: (): void => {},
};

export const isErrorWithCode = (_error: unknown): boolean => false;

export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
};
