// Web stub for @react-native-google-signin/google-signin.
// Google Sign-In is native-only; web users sign in with email/password.
export const GoogleSignin = {
  configure: () => {},
  hasPlayServices: () => Promise.resolve(true),
  signIn: () => Promise.reject(new Error('Google Sign-In is not supported on web')),
  signOut: () => Promise.resolve(),
  getTokens: () => Promise.reject(new Error('Google Sign-In is not supported on web')),
  isSignedIn: () => false,
  getCurrentUser: () => null,
  revokeAccess: () => Promise.resolve(),
};

export const GoogleSigninButton = () => null;
export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
};
