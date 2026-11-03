import {
  SegmentedButton as JCSegmentedButton,
  SingleChoiceSegmentedButtonRow as JCSingleChoiceSegmentedButtonRow,
  Text as JCText,
} from '@expo/ui/jetpack-compose';
import { testID as testIDModifier } from '@expo/ui/jetpack-compose/modifiers';
import { ThemedHost as JCHost } from './themed-host';

type SegmentedControlProps = {
  values: string[];
  selectedIndex?: number;
  enabled?: boolean;
  onIndexChange?: (index: number) => void;
  onValueChange?: (value: string) => void;
  tintColor?: string;
  testID?: string;
};

/**
 * MD3 segmented buttons on the app's own scheme. The `@expo/ui` community control hosts itself on
 * the device's palette and can only tint the selected container, so in dark mode its selected
 * label (the theme's on-secondary-container) sat light on the light primary tint. Here the whole
 * row uses the M3 roles: secondary-container behind the selected segment with its on-colour label.
 * `tintColor` still overrides the selected container for a call site that needs it.
 */
function SegmentedControl({
  values,
  selectedIndex,
  enabled = true,
  onIndexChange,
  onValueChange,
  tintColor,
  testID,
}: SegmentedControlProps) {
  return (
    <JCHost matchContents={{ vertical: true }}>
      <JCSingleChoiceSegmentedButtonRow modifiers={testID ? [testIDModifier(testID)] : undefined}>
        {values.map((label, index) => (
          <JCSegmentedButton
            key={label}
            selected={index === selectedIndex}
            enabled={enabled}
            colors={tintColor ? { activeContainerColor: tintColor } : undefined}
            onClick={() => {
              onIndexChange?.(index);
              onValueChange?.(label);
            }}
          >
            <JCSegmentedButton.Label>
              <JCText>{label}</JCText>
            </JCSegmentedButton.Label>
          </JCSegmentedButton>
        ))}
      </JCSingleChoiceSegmentedButtonRow>
    </JCHost>
  );
}

export { SegmentedControl };
