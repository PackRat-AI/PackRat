import * as Sentry from '@sentry/react-native';
import { userStore } from 'expo-app/features/auth/store';
import { apiClient } from 'expo-app/lib/api/packrat';
import { useState } from 'react';

export type UpdateProfilePayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string | null;
};

export function useUpdateProfile() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateProfile = async (payload: UpdateProfilePayload): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      Sentry.addBreadcrumb({
        category: 'profile',
        message: 'Updating user profile',
        level: 'info',
      });
      const { data, error: apiError } = await apiClient.user.profile.put(payload);
      if (apiError) {
        const err = new Error(String(apiError.value ?? 'Update failed'));
        Sentry.captureException(err, {
          tags: { feature: 'profile', action: 'updateProfile' },
          extra: { apiError: apiError.value, httpStatus: apiError.status },
        });
        setError(String(apiError.value ?? 'Update failed'));
        return false;
      }
      const responseData = data as { user?: unknown } | null;
      if (responseData?.user) {
        userStore.set(responseData.user as Parameters<typeof userStore.set>[0]);
      }
      return true;
    } catch (err) {
      Sentry.captureException(err, {
        tags: { feature: 'profile', action: 'updateProfile' },
      });
      setError(err instanceof Error ? err.message : 'Update failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { updateProfile, isLoading, error };
}
