import { Form, Host, LabeledContent, Picker, Section, Text, VStack } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { useSpeedUnit } from 'expo-app/features/auth/hooks/useSpeedUnit';
import { useTemperatureUnit } from 'expo-app/features/auth/hooks/useTemperatureUnit';
import { useWeightUnit } from 'expo-app/features/auth/hooks/useWeightUnit';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Stack } from 'expo-router';

/**
 * SPIKE — delete with its `.android.tsx` and fallback siblings once the direction is decided.
 *
 * The iOS half of the "Display Units" comparison. Verified on an iPhone 17 Pro simulator.
 *
 * `useViewportSizeMeasurement` is what makes a `Form` fill the screen — its own docs call out that
 * it exists for "SwiftUI views that need to fill their available space, such as `Form`". That prop
 * (with `onLayoutContent` and `matchContents`) landed in @expo/ui 56.0.8 and is precisely the
 * intrinsic-size machinery the migration concluded did not exist.
 *
 * The rows are `LabeledContent` rather than the `Picker`'s own `label` prop: SwiftUI's `.segmented`
 * picker style *hides* the label by design, so the first version of this file rendered three
 * unlabelled segmented controls. That is not an @expo/ui bug — it is SwiftUI semantics — but it is
 * the concrete reason a native screen is not "the same JSX twice". The Android sibling needs an
 * explicit `ListItem` with headline/supporting slots to reach the same result.
 *
 * Still not at parity: `LabeledContent` gives the label a fixed share of the row and *truncates*
 * ("For gear and pack…"), where the Compose `ListItem` wraps to two lines and grows the row.
 * Closing that gap needs a different row structure on iOS again. Left as-is deliberately — the
 * point of the spike is to measure the per-platform design work, not to hide it.
 */
export default function SettingsDisplayUnitsSpike() {
  const { unit: weightUnit, setWeightUnit } = useWeightUnit();
  const { unit: temperatureUnit, setTemperatureUnit } = useTemperatureUnit();
  const { unit: speedUnit, setSpeedUnit } = useSpeedUnit();
  const { colorScheme } = useColorScheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Display Units (native spike)' }} />
      <Host
        style={{ flex: 1 }}
        useViewportSizeMeasurement
        colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}
      >
        <Form>
          <Section title="Display Units">
            <LabeledContent
              label={
                <VStack alignment="leading" spacing={2}>
                  <Text>Weight</Text>
                  <Text>For gear and pack weights</Text>
                </VStack>
              }
            >
              <Picker
                selection={weightUnit}
                onSelectionChange={(value) => setWeightUnit(value === 'kg' ? 'kg' : 'lb')}
                modifiers={[pickerStyle('segmented')]}
              >
                <Text modifiers={[tag('kg')]}>kg</Text>
                <Text modifiers={[tag('lb')]}>lb</Text>
              </Picker>
            </LabeledContent>

            <LabeledContent
              label={
                <VStack alignment="leading" spacing={2}>
                  <Text>Temperature</Text>
                  <Text>For weather and forecasts</Text>
                </VStack>
              }
            >
              <Picker
                selection={temperatureUnit}
                onSelectionChange={(value) => setTemperatureUnit(value === 'C' ? 'C' : 'F')}
                modifiers={[pickerStyle('segmented')]}
              >
                <Text modifiers={[tag('C')]}>°C</Text>
                <Text modifiers={[tag('F')]}>°F</Text>
              </Picker>
            </LabeledContent>

            <LabeledContent
              label={
                <VStack alignment="leading" spacing={2}>
                  <Text>Wind &amp; Distance</Text>
                  <Text>For routes and weather data</Text>
                </VStack>
              }
            >
              <Picker
                selection={speedUnit}
                onSelectionChange={(value) => setSpeedUnit(value === 'kmh' ? 'kmh' : 'mph')}
                modifiers={[pickerStyle('segmented')]}
              >
                <Text modifiers={[tag('kmh')]}>km/h</Text>
                <Text modifiers={[tag('mph')]}>mph</Text>
              </Picker>
            </LabeledContent>
          </Section>
        </Form>
      </Host>
    </>
  );
}
