import { FilterChip, Host, Text as JCText, LazyRow } from '@expo/ui/jetpack-compose';
import { testID as testIDModifier } from '@expo/ui/jetpack-compose/modifiers';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { guideCategoryLabel } from '../lib/categories';

interface GuideCategoryChipsProps {
  categories: string[];
  /** Selected category slug, or `undefined` for All. */
  selected: string | undefined;
  onSelect: (category: string | undefined) => void;
}

/**
 * Single-select Material 3 `FilterChip` row, pinned under the app bar rather than scrolled with
 * the list: M3 places filters outside the collection they filter, and keeping the `Host` out of
 * the FlatList avoids a Compose surface inside an RN scroller (see
 * docs/migrations/nativewindui-to-expo-ui.md).
 */
export function GuideCategoryChips({ categories, selected, onSelect }: GuideCategoryChipsProps) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();

  const chipColors = {
    selectedContainerColor: colors.primary,
    selectedLabelColor: '#FFFFFF',
    labelColor: colors.foreground,
  };

  return (
    <Host matchContents={{ vertical: true, horizontal: false }} style={{ width: '100%' }}>
      <LazyRow
        horizontalArrangement={{ spacedBy: 8 }}
        contentPadding={{ start: 16, end: 16, top: 4, bottom: 8 }}
      >
        <FilterChip
          selected={selected === undefined}
          onClick={() => onSelect(undefined)}
          colors={chipColors}
          modifiers={[testIDModifier(testIds.guides.categoryChip('all'))]}
        >
          <FilterChip.Label>
            <JCText>{t('guides.all')}</JCText>
          </FilterChip.Label>
        </FilterChip>
        {categories.map((category) => (
          <FilterChip
            key={category}
            selected={selected === category}
            onClick={() => onSelect(category)}
            colors={chipColors}
            modifiers={[testIDModifier(testIds.guides.categoryChip(category))]}
          >
            <FilterChip.Label>
              <JCText>{guideCategoryLabel({ slug: category, t })}</JCText>
            </FilterChip.Label>
          </FilterChip>
        ))}
      </LazyRow>
    </Host>
  );
}
