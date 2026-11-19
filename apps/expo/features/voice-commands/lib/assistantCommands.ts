import * as Sentry from '@sentry/react-native';
import { tripsStore } from 'expo-app/features/trips/store/trips';
import { TripActions, type TripCommandTaskData } from 'expo-app/modules/trip-actions';
import { activeTrip } from '../utils/activeTrip';
import { VoiceAnswers } from '../utils/voiceAnswers';
import { trackStore } from './trackRecorder';
import { guideStore } from './tripGuide';
import { type AssistantResult, runForAssistant } from './voiceController';

/** Shows or hides the trip commands to Gemini and other assistants. */
export async function syncAssistantCommands(enabled: boolean): Promise<void> {
  if (!TripActions) return;
  try {
    await TripActions.setEnabled(enabled);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'voiceCommands', action: 'syncAssistantCommands' },
      extra: { enabled },
    });
  }
}

/**
 * The headless task the native side starts for each command, with PackRat open or not. Always
 * answers, so the assistant is never left waiting.
 */
export async function runAssistantCommandTask(data: TripCommandTaskData): Promise<void> {
  let result: AssistantResult = { answer: VoiceAnswers.commandFailed, needsConfirmation: false };
  try {
    const busyTripIds = [trackStore.track.peek()?.tripId, guideStore.session.peek()?.tripId].filter(
      (id): id is string => id != null,
    );
    const trip = activeTrip({
      trips: Object.values(tripsStore.peek() ?? {}),
      busyTripIds,
      now: new Date(),
    });
    result = await runForAssistant({ request: data.request, confirmed: data.confirmed, trip });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { feature: 'voiceCommands', action: 'assistantCommand' },
      extra: { confirmed: data.confirmed },
    });
  }
  TripActions?.respond(data.id, result.answer, result.needsConfirmation);
}
