import { Stack } from 'expo-router';

/**
 * Trail conditions stack: the searchable list, a report's detail, and the submit form.
 *
 * Mirrors the Swift app's navigation, where `TrailConditionsListView` pushes
 * `TrailConditionDetailView` and presents `SubmitTrailConditionView` as a sheet.
 *
 * Submit is a `modal` rather than a `formSheet`: on Android a form sheet renders no native
 * header, and the header is where Cancel and Submit belong — matching the Swift form's toolbar.
 */
export default function TrailConditionsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" />
      <Stack.Screen name="[reportId]" />
      <Stack.Screen
        name="submit"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  );
}
