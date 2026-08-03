import { Form, Host, Picker, Section, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { useSpeedUnit } from 'expo-app/features/auth/hooks/useSpeedUnit';
import { useTemperatureUnit } from 'expo-app/features/auth/hooks/useTemperatureUnit';
import { useWeightUnit } from 'expo-app/features/auth/hooks/useWeightUnit';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Stack } from 'expo-router';

/**
 * SPIKE — delete with its `.android.tsx` and fallback siblings once the direction is decided.
 *
 * The iOS half of the "Display Units" comparison. NOT VERIFIED ON DEVICE — no iOS hardware or
 * simulator was available in the session that wrote it, so treat the layout as unconfirmed.
 *
 * `useViewportSizeMeasurement` is what makes a `Form` fill the screen: its own docs call out that
 * it exists for "SwiftUI views that need to fill their available space, such as `Form`". That prop
 * (with `onLayoutContent` and `matchContents`) landed in @expo/ui 56.0.8 and is precisely the
 * intrinsic-size machinery the migration concluded did not exist.
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
            <Picker
              label="Weight"
              selection={weightUnit}
              onSelectionChange={(value) => setWeightUnit(value === 'kg' ? 'kg' : 'lb')}
              modifiers={[pickerStyle('segmented')]}
            >
              <Text modifiers={[tag('kg')]}>kg</Text>
              <Text modifiers={[tag('lb')]}>lb</Text>
            </Picker>

            <Picker
              label="Temperature"
              selection={temperatureUnit}
              onSelectionChange={(value) => setTemperatureUnit(value === 'C' ? 'C' : 'F')}
              modifiers={[pickerStyle('segmented')]}
            >
              <Text modifiers={[tag('C')]}>°C</Text>
              <Text modifiers={[tag('F')]}>°F</Text>
            </Picker>

            <Picker
              label="Wind & Distance"
              selection={speedUnit}
              onSelectionChange={(value) => setSpeedUnit(value === 'kmh' ? 'kmh' : 'mph')}
              modifiers={[pickerStyle('segmented')]}
            >
              <Text modifiers={[tag('kmh')]}>km/h</Text>
              <Text modifiers={[tag('mph')]}>mph</Text>
            </Picker>
          </Section>
        </Form>
      </Host>
    </>
  );
}
