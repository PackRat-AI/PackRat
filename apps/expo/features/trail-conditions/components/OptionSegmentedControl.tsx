import {
  Host,
  Text as JCText,
  SegmentedButton,
  SingleChoiceSegmentedButtonRow,
} from '@expo/ui/jetpack-compose';
import { testID as testIDModifier } from '@expo/ui/jetpack-compose/modifiers';
import { Text } from '@packrat/ui/src/text';
import { View } from 'react-native';

interface OptionSegmentedControlProps<T extends string> {
  label: string;
  options: readonly T[];
  value: NoInfer<T>;
  onChange: (value: NoInfer<T>) => void;
  formatLabel: (value: NoInfer<T>) => string;
  testIDForOption: (value: NoInfer<T>) => string;
}

/**
 * Single-select over a short option list, rendered with Material 3's
 * `SingleChoiceSegmentedButtonRow` — the Android counterpart of the SwiftUI `Picker` the Swift
 * form uses for Overall and Surface.
 *
 * This is the *leaf control* shape of @expo/ui adoption that is verified to work: one `Host`
 * around a self-contained native row with no React Native children. The label above it stays RN
 * so it keeps the app's typography.
 *
 * The `Host` carries an explicit height. Intrinsic sizing does not work here in either axis:
 * `matchContents` collapses a full-width native control, and matching only the vertical axis
 * reports no usable height to Yoga, so the row renders on top of the label above it (both seen
 * on-device). A segmented row is a single line of fixed-height buttons, so a fixed height is
 * correct — unlike the wrapping chip grid in `HazardChips`.
 */
export function OptionSegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  formatLabel,
  testIDForOption,
}: OptionSegmentedControlProps<T>) {
  return (
    <View className="gap-3">
      <Text variant="caption1" className="uppercase tracking-wide text-muted-foreground">
        {label}
      </Text>
      <Host style={{ height: 52 }}>
        <SingleChoiceSegmentedButtonRow>
          {options.map((option) => (
            <SegmentedButton
              key={option}
              selected={value === option}
              onClick={() => onChange(option)}
              // Without the testID modifier the control is a bare ComposeView with no child
              // node — invisible to both E2E and TalkBack. Verified on-device.
              modifiers={[testIDModifier(testIDForOption(option))]}
            >
              <SegmentedButton.Label>
                <JCText>{formatLabel(option)}</JCText>
              </SegmentedButton.Label>
            </SegmentedButton>
          ))}
        </SingleChoiceSegmentedButtonRow>
      </Host>
    </View>
  );
}
