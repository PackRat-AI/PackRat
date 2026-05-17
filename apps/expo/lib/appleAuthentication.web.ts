export const isAvailableAsync = (): Promise<boolean> => Promise.resolve(false);

export const signInAsync = (): Promise<never> =>
  Promise.reject(new Error('Apple Sign-In is not available on web.'));

export const AppleAuthenticationScope = { FULL_NAME: 0, EMAIL: 1 };
export const AppleAuthenticationOperation = { LOGIN: 0, REFRESH: 1, LOGOUT: 2, IMPLICIT: 3 };
export const AppleAuthenticationUserDetectionStatus = {
  UNKNOWN: 0,
  UNSUPPORTED: 1,
  LIKELY_REAL: 2,
};
