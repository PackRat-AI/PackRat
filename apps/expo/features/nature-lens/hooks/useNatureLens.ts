import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axiosInstance from 'expo-app/lib/api/client';
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
      const res = await axiosInstance.get('/nature-lens/identifications');
      setIdentifications(res.data.identifications);
      return res.data.identifications as NatureIdentification[];
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
        const res = await axiosInstance.post('/nature-lens/identify', data);
        setCurrentIdentification(res.data.identification);
        return res.data.identification as NatureIdentification;
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
      await axiosInstance.delete(`/nature-lens/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NATURE_LENS_QUERY_KEY, 'identifications'] });
    },
  });
}
