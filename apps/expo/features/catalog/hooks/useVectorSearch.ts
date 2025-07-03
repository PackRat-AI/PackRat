import { useQuery } from '@tanstack/react-query';
import { tokenAtom } from 'expo-app/features/auth/atoms/authAtoms';
import { useAuthenticatedQueryToolkit } from 'expo-app/lib/hooks/useAuthenticatedQueryToolkit';
import { useAtomValue } from 'jotai';

export const useVectorSearch = (query: string) => {
  const token = useAtomValue(tokenAtom);
  const { isQueryEnabledWithAccessToken } = useAuthenticatedQueryToolkit();

  return useQuery({
    queryKey: ['vectorSearch', query],
    enabled: isQueryEnabledWithAccessToken && !!query && query.length > 0 && !!token,

    queryFn: async () => {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/search/vector?q=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const errMsg = await response.text();
        throw new Error('Vector search failed');
      }

      const data = await response.json();
      return data;
    },
  });
};
