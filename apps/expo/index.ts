import 'expo-router/entry';
import { TRIP_COMMAND_TASK, type TripCommandTaskData } from 'expo-app/modules/trip-actions';
import { AppRegistry } from 'react-native';

// Gemini and other assistants run trip commands through this, with PackRat on screen or not.
// Loaded on first use, so it adds nothing to a normal launch.
AppRegistry.registerHeadlessTask(TRIP_COMMAND_TASK, () => async (data: TripCommandTaskData) => {
  const { runAssistantCommandTask } = await import(
    'expo-app/features/voice-commands/lib/assistantCommands'
  );
  await runAssistantCommandTask(data);
});
