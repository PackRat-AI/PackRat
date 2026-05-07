import { useMutation } from '@tanstack/react-query';
import { useApiClient } from '../../../shared/api';

interface RegisterBody {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export function useRegisterMutation() {
  const client = useApiClient();
  return useMutation({
    mutationFn: async (body: RegisterBody) => {
      const { data, error } = await client.auth.register.post(body);
      if (error) throw new Error('Registration failed');
      return data;
    },
  });
}
