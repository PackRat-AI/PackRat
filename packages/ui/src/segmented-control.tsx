import { SegmentedControl as ExpoSegmentedControl } from '@expo/ui/community/segmented-control';

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
  return (
    <ExpoSegmentedControl
      values={values}
      selectedIndex={selectedIndex}
      enabled={enabled}
      tintColor={tintColor}
      testID={testID}
      onChange={(event) => onIndexChange?.(event.nativeEvent.selectedSegmentIndex)}
      onValueChange={onValueChange}
    />
  );
}

export { SegmentedControl };
