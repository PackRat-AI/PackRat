import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateReportLists } from 'expo-app/features/trail-conditions/hooks/useTrailConditions';
import { getSettings, listBlocked, unblockUser, updateSettings } from '../lib/feedApi';
import type { PostAuthor, SocialSettings } from '../types';
import { feedKeys } from './queryKeys';

export const useSocialSettings = () =>
  useQuery({ queryKey: feedKeys.settings, queryFn: getSettings });

/** Saves one setting at a time; the switch moves at once and moves back if the save fails. */
export const useUpdateSocialSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSettings,
    onMutate: (changes) => {
      const previous = queryClient.getQueryData<SocialSettings>(feedKeys.settings);
      if (previous) queryClient.setQueryData(feedKeys.settings, { ...previous, ...changes });
    },
    // Re-read rather than guess: the server's copy is the truth after a failed save.
    onError: () => queryClient.invalidateQueries({ queryKey: feedKeys.settings }),
    onSuccess: (settings) => queryClient.setQueryData(feedKeys.settings, settings),
  });
};

export const useBlockedPeople = () => useQuery({ queryKey: feedKeys.blocks, queryFn: listBlocked });

export const useUnblockUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (person: PostAuthor) => unblockUser(person.id),
    onSuccess: (_data, person) => {
      queryClient.setQueryData<PostAuthor[]>(feedKeys.blocks, (people) =>
        people?.filter((p) => p.id !== person.id),
      );
      queryClient.invalidateQueries({ queryKey: feedKeys.lists });
      invalidateReportLists(queryClient);
    },
  });
};
