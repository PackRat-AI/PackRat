import * as SecureStore from 'expo-secure-store';
import * as React from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type UseStateHook<T> = [[boolean, T | null], (value?: T | null) => void];

function useAsyncState<T>(
  initialValue: [boolean, T | null] = [true, undefined],
): UseStateHook<T> {
  return React.useReducer(
    (state: [boolean, T | null], action: T | null = null) => [false, action],
    initialValue,
  ) as UseStateHook<T>;
}

export async function setStorageItemAsync(key: string, value: string | null) {
  if (Platform.OS === 'web') {
    try {
      if (value === null) {
        // localStorage.removeItem(key);
        // await AsyncStorage.removeItem('authToken');
        console.log('value', value);
      } else {
        console.log('value', value);
        // await AsyncStorage.setItem('authToken', value);
      }
    } catch (e) {
      console.error('Local storage is unavailable:', e);
    }
  } else {
    if (value == null) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  }
}

export function useStorageState(key: string): UseStateHook<string> {
  // Public
  const [state, setState] = useAsyncState<string>();

  // Get
  //   @ts-ignore
  useEffect(() => {
    const fetchStorageItem = async () => {
      if (Platform.OS === 'web') {
        try {
          if (typeof AsyncStorage !== 'undefined') {
            const item = await AsyncStorage.getItem(key);
            setState(item);
          }
        } catch (e) {
          console.error('Local storage is unavailable:', e);
        }
      } else {
        SecureStore.getItemAsync(key).then((value) => {
          setState(value);
        });
      }
    };

    fetchStorageItem();
  }, [key]);

  // Set
  const setValue = React.useCallback(
    (value: string | null) => {
      setStorageItemAsync(key, value).then(() => {
        setState(value);
      });
    },
    [key],
  );

  return [state, setValue];
}
