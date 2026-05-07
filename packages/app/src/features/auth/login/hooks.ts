import { useMutation } from '@tanstack/react-query';
import { useApiClient } from '../../../shared/api';

interface LoginBody {
  email: string;
  password: string;
}

export function useLoginMutation() {
  const client = useApiClient();
  return useMutation({
    mutationFn: async (body: LoginBody) => {
      const { data, error } = await client.auth.login.post(body);
      if (error) throw new Error('Login failed');
      return data;
    },
  });
}
