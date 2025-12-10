/**
 * On-Device AI Provider
 * Manages on-device AI mode and provides context for the app
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const ON_DEVICE_MODE_KEY = '@packrat:onDeviceAIMode';
const MODEL_DOWNLOADED_KEY = '@packrat:onDeviceModelDownloaded';

export type AIMode = 'cloud' | 'on-device' | 'hybrid';

interface OnDeviceAIContextValue {
  /**
   * Current AI mode
   */
  mode: AIMode;
  
  /**
   * Set the AI mode
   */
  setMode: (mode: AIMode) => Promise<void>;
  
  /**
   * Whether on-device model is downloaded
   */
  isModelDownloaded: boolean;
  
  /**
   * Set model downloaded status
   */
  setModelDownloaded: (downloaded: boolean) => Promise<void>;
  
  /**
   * Whether on-device AI is available
   */
  isOnDeviceAvailable: boolean;
  
  /**
   * Get the effective mode to use for a request
   * In hybrid mode, returns 'on-device' if available, otherwise 'cloud'
   */
  getEffectiveMode: () => AIMode;
}

const OnDeviceAIContext = createContext<OnDeviceAIContextValue | null>(null);

interface OnDeviceAIProviderProps {
  children: ReactNode;
}

/**
 * Provider for on-device AI functionality
 * 
 * @example
 * ```tsx
 * <OnDeviceAIProvider>
 *   <App />
 * </OnDeviceAIProvider>
 * ```
 */
export function OnDeviceAIProvider({ children }: OnDeviceAIProviderProps) {
  const [mode, setModeState] = useState<AIMode>('cloud');
  const [isModelDownloaded, setIsModelDownloadedState] = useState(false);
  const [isOnDeviceAvailable, setIsOnDeviceAvailable] = useState(false);

  // Load saved mode and model status on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [savedMode, modelDownloaded] = await Promise.all([
          AsyncStorage.getItem(ON_DEVICE_MODE_KEY),
          AsyncStorage.getItem(MODEL_DOWNLOADED_KEY),
        ]);

        if (savedMode) {
          setModeState(savedMode as AIMode);
        }

        if (modelDownloaded === 'true') {
          setIsModelDownloadedState(true);
        }

        // Check if on-device AI is available
        // Try to detect if native modules are available
        try {
          // In a real implementation, this would check for the native module
          // For PoC, we set it to true
          setIsOnDeviceAvailable(true);
        } catch (error) {
          console.warn('[OnDeviceAIProvider] Native modules not available:', error);
          setIsOnDeviceAvailable(false);
        }
      } catch (error) {
        console.error('[OnDeviceAIProvider] Failed to load settings:', error);
      }
    };

    loadSettings();
  }, []);

  const setMode = async (newMode: AIMode) => {
    try {
      await AsyncStorage.setItem(ON_DEVICE_MODE_KEY, newMode);
      setModeState(newMode);
    } catch (error) {
      console.error('[OnDeviceAIProvider] Failed to save mode:', error);
      throw error;
    }
  };

  const setModelDownloaded = async (downloaded: boolean) => {
    try {
      await AsyncStorage.setItem(MODEL_DOWNLOADED_KEY, downloaded.toString());
      setIsModelDownloadedState(downloaded);
    } catch (error) {
      console.error('[OnDeviceAIProvider] Failed to save model status:', error);
      throw error;
    }
  };

  const getEffectiveMode = (): AIMode => {
    if (mode === 'hybrid') {
      return isModelDownloaded && isOnDeviceAvailable ? 'on-device' : 'cloud';
    }
    return mode;
  };

  const value: OnDeviceAIContextValue = {
    mode,
    setMode,
    isModelDownloaded,
    setModelDownloaded,
    isOnDeviceAvailable,
    getEffectiveMode,
  };

  return (
    <OnDeviceAIContext.Provider value={value}>
      {children}
    </OnDeviceAIContext.Provider>
  );
}

/**
 * Hook to access on-device AI context
 * 
 * @example
 * ```tsx
 * const { mode, setMode, isModelDownloaded } = useOnDeviceAI();
 * 
 * // Check if we should use on-device mode
 * const effectiveMode = getEffectiveMode();
 * ```
 */
export function useOnDeviceAI(): OnDeviceAIContextValue {
  const context = useContext(OnDeviceAIContext);
  
  if (!context) {
    throw new Error('useOnDeviceAI must be used within OnDeviceAIProvider');
  }
  
  return context;
}
