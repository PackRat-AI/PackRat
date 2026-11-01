import { FilterChip, FlowRow, Host, Text as JCText } from '@expo/ui/jetpack-compose';
import { testID as testIDModifier } from '@expo/ui/jetpack-compose/modifiers';
import { Text } from '@packrat/ui/src/text';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { View } from 'react-native';

interface ChoiceChipsProps<T extends string> {
  label: string;
  options: readonly T[];
  value: NoInfer<T>;
  onChange: (value: NoInfer<T>) => void;
  formatLabel: (value: NoInfer<T>) => string;
  testIDForOption: (value: NoInfer<T>) => string;
}

/**
 * Single-select over a list too long for a segmented row, as Material 3 filter chips that wrap.
 * M3 caps segmented buttons at five; the six trail surfaces squeezed into one row broke every
 * label mid-word, so they use chips, styled like the hazard chips beside them.
 */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
  formatLabel,
  testIDForOption,
}: ChoiceChipsProps<T>) {
  const { colors } = useColorScheme();

  return (
    <View className="gap-3">
      <Text variant="caption1" className="uppercase tracking-wide text-muted-foreground">
        {label}
      </Text>
      <Host matchContents={{ vertical: true, horizontal: false }} style={{ width: '100%' }}>
        <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 8 }}>
          {options.map((option) => (
            <FilterChip
              key={option}
              selected={option === value}
              onClick={() => onChange(option)}
              modifiers={[testIDModifier(testIDForOption(option))]}
              colors={{
                selectedContainerColor: colors.primary,
                selectedLabelColor: '#FFFFFF',
                selectedLeadingIconColor: '#FFFFFF',
                labelColor: colors.foreground,
              }}
            >
              <FilterChip.Label>
                <JCText>{formatLabel(option)}</JCText>
              </FilterChip.Label>
            </FilterChip>
          ))}
        </FlowRow>
      </Host>
    </View>
  );
}
