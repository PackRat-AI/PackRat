import type { MaterialIconName } from 'expo-app/components/Icon';

export type IntroArtwork = { kind: 'logo' } | { kind: 'icon'; name: MaterialIconName };

export type IntroPage = {
  key: string;
  artwork: IntroArtwork;
  /** i18n key prefix under `intro.pages`. */
  copyKey: 'welcome' | 'packs' | 'trips' | 'conditions' | 'anywhere';
  background: string;
};

/** One outdoor colour per page, each dark enough for white text. Matches the iOS intro. */
export const INTRO_PALETTE = Object.freeze({
  forest: '#337F63',
  ember: '#CC6621',
  sky: '#0D6BCC',
  lake: '#0D7587',
  dusk: '#54408C',
} as const);

export const INTRO_PAGES: readonly IntroPage[] = Object.freeze([
  {
    key: 'welcome',
    artwork: { kind: 'logo' },
    copyKey: 'welcome',
    background: INTRO_PALETTE.forest,
  },
  {
    key: 'packs',
    artwork: { kind: 'icon', name: 'format-list-checks' },
    copyKey: 'packs',
    background: INTRO_PALETTE.ember,
  },
  {
    key: 'trips',
    artwork: { kind: 'icon', name: 'map' },
    copyKey: 'trips',
    background: INTRO_PALETTE.sky,
  },
  {
    key: 'conditions',
    artwork: { kind: 'icon', name: 'weather-partly-cloudy' },
    copyKey: 'conditions',
    background: INTRO_PALETTE.lake,
  },
  {
    key: 'anywhere',
    artwork: { kind: 'icon', name: 'image-filter-hdr' },
    copyKey: 'anywhere',
    background: INTRO_PALETTE.dusk,
  },
]);
