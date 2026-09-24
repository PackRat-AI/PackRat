import { FilterChip, FlowRow, Host, Text as JCText } from '@expo/ui/jetpack-compose';
import { testID as testIDModifier } from '@expo/ui/jetpack-compose/modifiers';
import { Text } from '@packrat/ui/src/text';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { testIds } from 'expo-app/lib/testIds';
import { View } from 'react-native';
import { capitalizeFirst } from '../lib/display';

interface HazardChipsProps {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

/**
 * Multi-select hazards, rendered as Material 3 `FilterChip`s — M3's canonical control for
 * selecting several tag-like values, and the Android counterpart of the list of `Toggle` rows
 * the Swift form uses.
 *
 * Chips rather than a column of switches because seven independent switches is a tall, noisy
 * section, while chips wrap into two or three lines and read as one set. The selection semantics
 * are identical, which is what parity requires.
 */
export function HazardChips({ label, options, selected, onChange }: HazardChipsProps) {
  const { colors } = useColorScheme();

  const toggle = (hazard: string) => {
    onChange(
      selected.includes(hazard)
        ? selected.filter((item) => item !== hazard)
        : [...selected, hazard],
    );
  };

  return (
    <View className="gap-3">
      <Text variant="caption1" className="uppercase tracking-wide text-muted-foreground">
        {label}
      </Text>
      {/* Height follows the chips, width fills the row. A fixed height clipped the last chip
          whenever the labels wrapped to a third line; `matchContents` on the vertical axis only
          avoids that without reintroducing the collapse a fully intrinsic `Host` causes. */}
      <Host matchContents={{ vertical: true, horizontal: false }} style={{ width: '100%' }}>
        <FlowRow horizontalArrangement={{ spacedBy: 8 }} verticalArrangement={{ spacedBy: 8 }}>
          {options.map((hazard) => {
            const isSelected = selected.includes(hazard);
            return (
              <FilterChip
                key={hazard}
                selected={isSelected}
                onClick={() => toggle(hazard)}
                modifiers={[testIDModifier(testIds.trailConditions.hazardChip(hazard))]}
                colors={{
                  selectedContainerColor: colors.primary,
                  selectedLabelColor: '#FFFFFF',
                  selectedLeadingIconColor: '#FFFFFF',
                  labelColor: colors.foreground,
                }}
              >
                <FilterChip.Label>
                  <JCText>{capitalizeFirst(hazard)}</JCText>
                </FilterChip.Label>
              </FilterChip>
            );
          })}
        </FlowRow>
      </Host>
    </View>
  );
}
