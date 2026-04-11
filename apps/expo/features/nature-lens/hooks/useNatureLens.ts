import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from 'app/lib/api';
import { useAtom } from 'jotai';
import {
  currentIdentificationAtom,
  identificationErrorAtom,
  isIdentifyingAtom,
  natureIdentificationsAtom,
} from '../atoms/natureLensAtoms';
import type { IdentifyImageRequest, NatureIdentification } from '../types';

const NATURE_LENS_QUERY_KEY = 'nature-lens';

export function useNatureIdentifications() {
  const [, setIdentifications] = useAtom(natureIdentificationsAtom);

  return useQuery({
    queryKey: [NATURE_LENS_QUERY_KEY, 'identifications'],
    queryFn: async () => {
      const response = await api.get('/nature-lens/identifications');
      setIdentifications(response.identifications);
      return response.identifications as NatureIdentification[];
    },
  });
}

export function useIdentifyImage() {
  const queryClient = useQueryClient();
  const [, setCurrentIdentification] = useAtom(currentIdentificationAtom);
  const [, setIsIdentifying] = useAtom(isIdentifyingAtom);
  const [, setError] = useAtom(identificationErrorAtom);

  return useMutation({
    mutationFn: async (data: IdentifyImageRequest) => {
      setIsIdentifying(true);
      setError(null);
      try {
        const response = await api.post('/nature-lens/identify', data);
        setCurrentIdentification(response.identification);
        return response.identification as NatureIdentification;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Identification failed';
        setError(message);
        throw err;
      } finally {
        setIsIdentifying(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NATURE_LENS_QUERY_KEY, 'identifications'] });
    },
  });
}

export function useDeleteIdentification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/nature-lens/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NATURE_LENS_QUERY_KEY, 'identifications'] });
    },
  });
}
