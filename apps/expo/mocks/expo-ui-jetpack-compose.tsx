// Web stub for @expo/ui/jetpack-compose.
// Every Compose view calls requireNativeView at module scope, which throws on web, so merely
// importing the package from a shared file crashes the web app. Callers only render these on
// Android, so on web each export renders nothing. Add an export here when a shared file starts
// importing a new one. (@expo/ui/jetpack-compose/modifiers is plain JS and needs no stub.)
export type { HostProps, MaterialColors } from '@expo/ui/jetpack-compose';

const Empty = () => null;

export const AlertDialog = Empty;
export const Column = Empty;
export const FilterChip = Empty;
export const FlowRow = Empty;
export const Host = Empty;
export const LazyRow = Empty;
export const LinearProgressIndicator = Empty;
export const RadioButton = Empty;
export const Row = Empty;
export const SegmentedButton = Empty;
export const SingleChoiceSegmentedButtonRow = Empty;
export const Text = Empty;
export const TextButton = Empty;
