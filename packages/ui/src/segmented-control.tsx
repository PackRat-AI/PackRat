import { SegmentedControl as ExpoSegmentedControl } from '@expo/ui/community/segmented-control';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';

type SegmentedControlProps = {
  values: string[];
  selectedIndex?: number;
  enabled?: boolean;
  onIndexChange?: (index: number) => void;
  onValueChange?: (value: string) => void;
  tintColor?: string;
  testID?: string;
};

function SegmentedControl({
  values,
  selectedIndex,
  enabled,
  onIndexChange,
  onValueChange,
  tintColor,
  testID,
}: SegmentedControlProps) {
  const { colors } = useColorScheme();
  // This is one of the two components still backed by @expo/ui, so it paints from the *platform*
  // palette rather than the app's. Left untinted on Android it picks up Material You's dynamic
  // colour, which on a device themed brown rendered a brown selected segment in an app whose
  // accent is blue everywhere else. Defaulting to the theme's primary keeps it on-brand; call
  // sites can still override.
  return (
    <ExpoSegmentedControl
      values={values}
      selectedIndex={selectedIndex}
      enabled={enabled}
      tintColor={tintColor ?? colors.primary}
      testID={testID}
      onChange={(event) => onIndexChange?.(event.nativeEvent.selectedSegmentIndex)}
      onValueChange={onValueChange}
    />
  );
}

export { SegmentedControl };
