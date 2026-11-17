import { objectKeys } from '@packrat/guards';
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
    // Every setting is a switch, so a failed save flips back the ones it touched; the re-read
    // then settles on the server's copy.
    onError: (_error, changes) => {
      queryClient.setQueryData<SocialSettings>(feedKeys.settings, (current) => {
        if (!current) return current;
        const restored = { ...current };
        for (const key of objectKeys(changes)) {
          const requested = changes[key];
          if (requested !== undefined) restored[key] = !requested;
        }
        return restored;
      });
      queryClient.invalidateQueries({ queryKey: feedKeys.settings });
    },
    // Take only the fields this save sent: a slower reply to an earlier save must not undo a
    // newer one.
    onSuccess: (settings, changes) =>
      queryClient.setQueryData<SocialSettings>(feedKeys.settings, (current) => {
        if (!current) return settings;
        const merged = { ...current };
        for (const key of objectKeys(changes)) merged[key] = settings[key];
        return merged;
      }),
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
