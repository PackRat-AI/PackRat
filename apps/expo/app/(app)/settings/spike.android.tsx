import {
  Card,
  Column,
  Host,
  ListItem,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
  Text,
} from '@expo/ui/jetpack-compose';
import { useSpeedUnit } from 'expo-app/features/auth/hooks/useSpeedUnit';
import { useTemperatureUnit } from 'expo-app/features/auth/hooks/useTemperatureUnit';
import { useWeightUnit } from 'expo-app/features/auth/hooks/useWeightUnit';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Stack } from 'expo-router';

/**
 * SPIKE — delete once the Expo UI direction is decided.
 *
 * Reimplements the "Display Units" section of `settings/index.tsx` the way @expo/ui is actually
 * designed to be used, to measure the cost against the existing RN version:
 *
 *   - ONE `Host` at the section boundary, not one per control. Yoga only ever measures this box;
 *     everything inside is laid out by Compose. That sidesteps the "Host has no intrinsic size"
 *     problem the migration hit by wrapping each leaf control in its own Host.
 *   - Platform-specific entry point (`@expo/ui/jetpack-compose`), not the universal layer. Expo's
 *     own guide says universal support "will come in the next stage of the roadmap"; the 1:1
 *     native mappings are the mature path.
 *   - Native components mirroring the native API (`ListItem` and `SegmentedButton` with their
 *     slot sub-components), no NativeWind classes, no RN children.
 *
 * `Host.colorScheme` is driven from the app's manual toggle so the Compose surface follows the
 * in-app theme rather than the OS setting.
 */
export default function SettingsDisplayUnitsSpike() {
  const { unit: weightUnit, setWeightUnit } = useWeightUnit();
  const { unit: temperatureUnit, setTemperatureUnit } = useTemperatureUnit();
  const { unit: speedUnit, setSpeedUnit } = useSpeedUnit();
  const { colorScheme } = useColorScheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Display Units (native spike)' }} />
      <Host style={{ flex: 1 }} colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}>
        <Column>
          <Card>
            <ListItem>
              <ListItem.HeadlineContent>
                <Text>Weight</Text>
              </ListItem.HeadlineContent>
              <ListItem.SupportingContent>
                <Text>For gear and pack weights</Text>
              </ListItem.SupportingContent>
              <ListItem.TrailingContent>
                <SingleChoiceSegmentedButtonRow>
                  <SegmentedButton
                    selected={weightUnit === 'kg'}
                    onClick={() => setWeightUnit('kg')}
                  >
                    <SegmentedButton.Label>
                      <Text>kg</Text>
                    </SegmentedButton.Label>
                  </SegmentedButton>
                  <SegmentedButton
                    selected={weightUnit === 'lb'}
                    onClick={() => setWeightUnit('lb')}
                  >
                    <SegmentedButton.Label>
                      <Text>lb</Text>
                    </SegmentedButton.Label>
                  </SegmentedButton>
                </SingleChoiceSegmentedButtonRow>
              </ListItem.TrailingContent>
            </ListItem>

            <ListItem>
              <ListItem.HeadlineContent>
                <Text>Temperature</Text>
              </ListItem.HeadlineContent>
              <ListItem.SupportingContent>
                <Text>For weather and forecasts</Text>
              </ListItem.SupportingContent>
              <ListItem.TrailingContent>
                <SingleChoiceSegmentedButtonRow>
                  <SegmentedButton
                    selected={temperatureUnit === 'C'}
                    onClick={() => setTemperatureUnit('C')}
                  >
                    <SegmentedButton.Label>
                      <Text>°C</Text>
                    </SegmentedButton.Label>
                  </SegmentedButton>
                  <SegmentedButton
                    selected={temperatureUnit === 'F'}
                    onClick={() => setTemperatureUnit('F')}
                  >
                    <SegmentedButton.Label>
                      <Text>°F</Text>
                    </SegmentedButton.Label>
                  </SegmentedButton>
                </SingleChoiceSegmentedButtonRow>
              </ListItem.TrailingContent>
            </ListItem>

            <ListItem>
              <ListItem.HeadlineContent>
                <Text>Wind &amp; Distance</Text>
              </ListItem.HeadlineContent>
              <ListItem.SupportingContent>
                <Text>For routes and weather data</Text>
              </ListItem.SupportingContent>
              <ListItem.TrailingContent>
                <SingleChoiceSegmentedButtonRow>
                  <SegmentedButton
                    selected={speedUnit === 'kmh'}
                    onClick={() => setSpeedUnit('kmh')}
                  >
                    <SegmentedButton.Label>
                      <Text>km/h</Text>
                    </SegmentedButton.Label>
                  </SegmentedButton>
                  <SegmentedButton
                    selected={speedUnit === 'mph'}
                    onClick={() => setSpeedUnit('mph')}
                  >
                    <SegmentedButton.Label>
                      <Text>mph</Text>
                    </SegmentedButton.Label>
                  </SegmentedButton>
                </SingleChoiceSegmentedButtonRow>
              </ListItem.TrailingContent>
            </ListItem>
          </Card>
        </Column>
      </Host>
    </>
  );
}
