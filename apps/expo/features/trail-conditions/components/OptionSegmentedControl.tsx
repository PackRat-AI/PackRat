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
 * `Host` is given an explicit height rather than `matchContents` — a full-width native control
 * collapses under intrinsic sizing (verified on-device; the same fix as `toggle.android.tsx`).
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
      <Host style={{ height: 48 }}>
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
