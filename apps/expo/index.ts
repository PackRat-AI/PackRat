import 'expo-router/entry';
import { TRIP_COMMAND_TASK, type TripCommandTaskData } from 'expo-app/modules/trip-actions';
import { AppRegistry, Platform } from 'react-native';

// Gemini and other assistants run trip commands through this, with PackRat on screen or not.
// Loaded on first use, so it adds nothing to a normal launch. Headless tasks are Android-only;
// react-native-web's AppRegistry has no registerHeadlessTask, so calling it there crashes the app.
if (Platform.OS === 'android') {
  AppRegistry.registerHeadlessTask(TRIP_COMMAND_TASK, () => async (data: TripCommandTaskData) => {
    const { runAssistantCommandTask } = await import(
      'expo-app/features/voice-commands/lib/assistantCommands'
    );
    await runAssistantCommandTask(data);
  });
}
