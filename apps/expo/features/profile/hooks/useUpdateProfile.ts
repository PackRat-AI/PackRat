import { userStore } from 'expo-app/features/auth/store';
import axiosInstance, { handleApiError } from 'expo-app/lib/api/client';
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
      const response = await axiosInstance.put('/api/user/profile', payload);
      if (response.data?.user) {
        userStore.set(response.data.user);
      }
      return true;
    } catch (err) {
      const { message } = handleApiError(err);
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { updateProfile, isLoading, error };
}