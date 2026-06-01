export const AFTER_FIRST_UNLOCK = 'AFTER_FIRST_UNLOCK';
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY';
export const ALWAYS = 'ALWAYS';
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 'WHEN_PASSCODE_SET_THIS_DEVICE_ONLY';
export const ALWAYS_THIS_DEVICE_ONLY = 'ALWAYS_THIS_DEVICE_ONLY';
export const WHEN_UNLOCKED = 'WHEN_UNLOCKED';
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'WHEN_UNLOCKED_THIS_DEVICE_ONLY';

export async function isAvailableAsync(): Promise<boolean> {
  return true;
}

export async function getItemAsync(key: string): Promise<string | null> {
  return localStorage.getItem(key);
}

export function getItem(key: string): string | null {
  return localStorage.getItem(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  localStorage.setItem(key, value);
}

export function setItem(key: string, value: string): void {
  localStorage.setItem(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  localStorage.removeItem(key);
}

export function canUseBiometricAuthentication(): boolean {
  return false;
}
