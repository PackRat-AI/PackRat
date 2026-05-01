// Web stub: Apple Sign-In is iOS-only. On web, availability returns false.
export const isAvailableAsync = (): Promise<boolean> => Promise.resolve(false);

export const signInAsync = (): Promise<never> =>
  Promise.reject(new Error('Apple Sign-In is not supported on web. Please use email/password.'));

export const AppleAuthenticationScope = {
  FULL_NAME: 0,
  EMAIL: 1,
};

export const AppleAuthenticationOperation = {
  LOGIN: 0,
  REFRESH: 1,
  LOGOUT: 2,
  IMPLICIT: 3,
};

export const AppleAuthenticationRealUserStatus = {
  UNKNOWN: 0,
  UNSUPPORTED: 1,
  LIKELY_REAL: 2,
};
