import { requireOptionalNativeModule } from 'expo-modules-core';

interface TripActionsNativeModule {
  respond(id: string, answer: string, needsConfirmation: boolean): boolean;
  setEnabled(enabled: boolean): Promise<boolean>;
}

/** Trip commands for Gemini and other assistants. Android only; null where the native module isn't built in. */
export const TripActions = requireOptionalNativeModule<TripActionsNativeModule>('TripActions');

/** The name the native side starts the headless task under. */
export const TRIP_COMMAND_TASK = 'PackRatTripCommand';

/** What the native side passes the headless task. */
export interface TripCommandTaskData {
  id: string;
  request: string;
  confirmed: boolean;
}
