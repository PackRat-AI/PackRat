import { Badge as JCBadge, Host as JCHost } from '@expo/ui/jetpack-compose';
import { testID as testIDModifier } from '@expo/ui/jetpack-compose/modifiers';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { cssInterop } from 'nativewind';
import type { ComponentProps } from 'react';
import type { BadgeDotProps } from './badge-dot-props';

cssInterop(JCHost, { className: 'style' });

// Same widened Host type as toggle.android.tsx — see the note there.
type HostProps = ComponentProps<typeof JCHost> & { className?: string };
const Host = JCHost as (props: HostProps) => ReturnType<typeof JCHost>;

/**
 * Material 3 small `Badge` — the 6dp dot with no count, which M3 uses to say
 * "something new here" when the number does not matter. A leaf control in its
 * own `Host`, so it drops into any RN row.
 *
 * The dot is decorative: the row that carries it owns the accessible meaning.
 */
function BadgeDot({ className, style, testID }: BadgeDotProps) {
  const { colors } = useColorScheme();
  return (
    <Host matchContents className={className} style={style}>
      <JCBadge containerColor={colors.destructive} modifiers={[testIDModifier(testID)]} />
    </Host>
  );
}

export { BadgeDot };
export type { BadgeDotProps };
