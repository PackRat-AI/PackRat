import { use$ } from '@legendapp/state/react';
import { preferencesStore } from 'expo-app/features/auth/store/preferences';

export function useSeasonSuggestionsPrefs() {
  const announcementSeen = use$(preferencesStore.seasonSuggestions.announcementSeen) ?? false;
  const opened = use$(preferencesStore.seasonSuggestions.opened) ?? false;

  const setAnnouncementSeen = (value: boolean) => {
    preferencesStore.seasonSuggestions.assign({ announcementSeen: value });
  };

  const setOpened = (value: boolean) => {
    preferencesStore.seasonSuggestions.assign({ opened: value });
  };

  return { announcementSeen, setAnnouncementSeen, opened, setOpened };
}
