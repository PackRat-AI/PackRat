import { Card as JCCard, Host as JCHost, RNHostView } from '@expo/ui/jetpack-compose';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { cssInterop } from 'nativewind';
import type { ComponentProps } from 'react';
import { View } from 'react-native';
import type { CardProps } from './card-parts';

cssInterop(JCHost, { className: 'style' });

// jetpack-compose's Host prop type doesn't extend RN's ViewProps, so NativeWind's global
// className→style augmentation never reaches it. The cssInterop call above makes className work at
// runtime; this widened type tells TS the same. Same recipe as toggle.android.tsx.
type HostProps = ComponentProps<typeof JCHost> & { className?: string };
const Host = JCHost as (props: HostProps) => ReturnType<typeof JCHost>;

const DEFAULT_ELEVATION = 2;

/**
 * Material 3 `Card` — a real Compose card surface with the card's React Native children rendered
 * inside it through `RNHostView`.
 *
 * Verified in PackRat's own dev client (not the nativewindui rig, which cannot answer styling
 * questions for `@packrat/ui` components — see docs/migrations/nativewindui-to-expo-ui.md): the
 * surface draws with real Material elevation and rounded corners, an explicit `containerColor` is
 * honoured, and the hosted RN children lay out correctly inside it with their own accessibility
 * nodes intact.
 *
 * `matchContents` on **both** the `Host` and the `RNHostView` is what makes it work: the card sizes to
 * its content the way the RN version did, while the hosted subtree still lays out normally. It cannot
 * change after mount (the component force-remounts on change), so it is fixed here rather than
 * exposed.
 *
 * Requires `@expo/ui` >= 57.0.8, which fixed hosted touchables dropping presses on any finger
 * movement (expo/expo#48131) and made `RNHostView` report the right coordinate space via `layoutRoot`.
 *
 * Call sites that pass `rootClassName="… shadow-none bg-inherit"` are opting out of the card surface
 * to draw their own border. Tailwind can't reach a native card, so those intents map onto the real
 * Compose props: a flat+bordered card is a filled `Card` at zero elevation with an explicit border —
 * Material's `OutlinedCard` collapsed to a hairline on-device, so it is deliberately not used.
 *
 * **`rootClassName` is deliberately NOT forwarded to the `Host`.** That was the bug behind three
 * earlier failed attempts at this component: `cssInterop` turns the className into a `style` on the
 * `Host`, which fights `matchContents` and collapses the whole card to a hairline. Isolated on-device —
 * `shadow-none` alone, `border` alone, and the combined ToolCard shape all collapsed, while the same
 * card with no `rootClassName` rendered perfectly. The className's *intent* is read above and mapped to
 * Compose props instead; `rootStyle` still passes through, since an explicit style is the caller
 * knowingly sizing the host.
 */
function Card({ className, rootClassName, rootStyle, ...props }: CardProps) {
  const { colors } = useColorScheme();

  const flat = rootClassName?.includes('shadow-none') ?? false;
  const bordered = rootClassName?.includes('border') ?? false;
  // `bg-inherit` means "don't paint your own fill", which for a filled card means the screen
  // background rather than literal transparency — a transparent container collapses the Compose
  // surface to nothing (measured on-device: the OutlinedCard rendered as a bare line).
  const transparent = rootClassName?.includes('bg-inherit') ?? false;
  const containerColor = transparent ? colors.background : colors.card;

  const content = (
    <RNHostView matchContents>
      <View className={cn('justify-end overflow-hidden', className)} {...props} />
    </RNHostView>
  );

  // Each branch renders the @expo/ui component as a literal JSX tag with static props — these are
  // native views resolved by name, so a component variable plus a spread ternary is not equivalent.
  //
  // `OutlinedCard` is deliberately NOT used for the flat+bordered case: on-device it collapsed to a
  // bare hairline regardless of container colour. A filled `Card` at zero elevation with an explicit
  // border draws the same intent and actually renders.
  if (flat && bordered) {
    return (
      <Host matchContents style={rootStyle}>
        <JCCard
          colors={{ containerColor }}
          elevation={0}
          border={{ width: 1, color: colors.grey5 }}
        >
          {content}
        </JCCard>
      </Host>
    );
  }

  return (
    <Host matchContents style={rootStyle}>
      <JCCard colors={{ containerColor }} elevation={flat ? 0 : DEFAULT_ELEVATION}>
        {content}
      </JCCard>
    </Host>
  );
}

export { CardContent, CardDescription, CardFooter, CardSubtitle, CardTitle } from './card-parts';
export { Card };
export type { CardProps };
