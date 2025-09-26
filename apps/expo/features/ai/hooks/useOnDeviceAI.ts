import { useEffect, useState, useCallback } from 'react';
import { detectDeviceCapabilities, type DeviceCapabilities, type OnDeviceProvider } from '../providers/on-device-ai';

export interface UseOnDeviceAIReturn {
  capabilities: DeviceCapabilities | null;
  isLoading: boolean;
  error: string | null;
  isOnDeviceAvailable: boolean;
  recommendedProvider: OnDeviceProvider | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to detect and manage on-device AI capabilities
 */
export function useOnDeviceAI(): UseOnDeviceAIReturn {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const detectCapabilities = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const detected = await detectDeviceCapabilities();
      setCapabilities(detected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect capabilities');
      console.error('Failed to detect device AI capabilities:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    detectCapabilities();
  }, [detectCapabilities]);

  return {
    capabilities,
    isLoading,
    error,
    isOnDeviceAvailable: capabilities?.recommendedProvider !== null,
    recommendedProvider: capabilities?.recommendedProvider || null,
    refresh: detectCapabilities,
  };
}