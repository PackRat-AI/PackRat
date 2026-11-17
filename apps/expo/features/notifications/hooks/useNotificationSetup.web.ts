// Web has no push notifications — expo-notifications' native methods throw on web, so Metro
// resolves this no-op in place of useNotificationSetup.ts for web builds.
export function useNotificationSetup(_: { isAuthed: boolean }) {}
