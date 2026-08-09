import {
  DropdownMenu as JCDropdownMenu,
  DropdownMenuItem as JCDropdownMenuItem,
  Host as JCHost,
  Text as JCText,
  RNHostView,
} from '@expo/ui/jetpack-compose';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import * as React from 'react';
import { Pressable } from 'react-native';
import type { DropdownItem, DropdownMenuProps, DropdownSubMenu } from './types';

/**
 * Material 3 `DropdownMenu` for Android, replacing the `@rn-primitives/dropdown-menu` + Reanimated
 * composition.
 *
 * Our menu is data-driven — items are a serialisable tree (`actionKey`, `title`, nested `items`) — so
 * only the trigger stays React Native while the menu surface is entirely native.
 *
 * **Uses the low-level `DropdownMenu` primitive, not `community/menu`'s `MenuView`.** `MenuView` wraps
 * the trigger in its own `Pressable` which claims the Android gesture, so a `Pressable` child — which
 * every one of our call sites passes, as `<Button size="icon" variant="plain">` — never opens the menu.
 * Measured on-device: a bare `View` trigger opened it, the identical `Button` did not. This primitive's
 * `Trigger` is a passthrough (`<>{children}</>`), so our own `Pressable` keeps both the gesture and the
 * trigger's `@packrat/ui` styling.
 *
 * Verified on-device: trigger keeps its styling and opens the menu, every row dispatches its own
 * `actionKey`, and `destructive` renders a genuinely red label via `elementColors.textColor` (which
 * `community/menu`'s `MenuAction` had no way to express).
 *
 * ## Known upstream defect, and why it is not reachable here
 *
 * `DropdownMenuItem`'s `enabled={false}` is **presentation-only**: it greys the label but does not block
 * the press. Five independent workarounds were tried and all failed identically, including passing
 * `onClick={undefined}` so no JS callback exists at all. The native Kotlin looks correct
 * (`enabled = props.enabled` goes straight into Compose's `DropdownMenuItem`), so `enabled` evidently
 * reaches the colour path but not the click path. See the migration doc for the full elimination trail.
 *
 * That defect is **unreachable in this app**: no call site sets `disabled` on a dropdown item (checked
 * across every `createDropdownItem` usage — real items use only `actionKey`, `title` and `icon`). The
 * `disabled` flag is still honoured as far as the platform allows — greyed label, plus a JS-side guard —
 * so if a call site ever adds one it degrades to "looks disabled, still fires" rather than silently
 * doing nothing. Revisit if that becomes a real requirement.
 *
 * Other gaps, handled explicitly rather than silently dropped:
 * - `subTitle` — no second-line slot, so it is appended to the label.
 * - `icon` — no `LeadingIcon` slot is emitted, because ours is a name string and the native slot needs
 *   a drawable. Note the RN implementation doesn't render these icons on Android either: call sites
 *   pass SF Symbol names (`house.fill`), so both old and new show the same `?` placeholder. Verified by
 *   capturing the RN menu on the same screen — this migration is visually equivalent, and the missing
 *   icons are a pre-existing SF-Symbol-on-Android gap, not a regression.
 * - `keepOpenOnPress` — the native menu always closes on selection.
 * - Nested submenus — Compose's `DropdownMenu` has no submenu slot, so they are flattened inline.
 * - The `material*` positioning props — the native menu anchors itself. Accepted and ignored, the same
 *   contract they already had on iOS.
 */
function isSubMenu(item: DropdownItem | DropdownSubMenu): item is DropdownSubMenu {
  return 'items' in item;
}

function flatten(items: (DropdownItem | DropdownSubMenu)[]): DropdownItem[] {
  return items.flatMap((item) => (isSubMenu(item) ? flatten(item.items) : [item]));
}

function DropdownMenu({ items, children, onItemPress, enabled, testID }: DropdownMenuProps) {
  const { colors } = useColorScheme();
  const [expanded, setExpanded] = React.useState(false);
  const visible = React.useMemo(() => flatten(items).filter((i) => !i.hidden), [items]);

  return (
    <JCHost matchContents>
      <JCDropdownMenu expanded={expanded} onDismissRequest={() => setExpanded(false)}>
        <JCDropdownMenu.Trigger>
          {/* Trigger is a passthrough, so this Pressable owns the gesture — the whole reason for
              choosing this primitive over MenuView. */}
          <RNHostView matchContents>
            <Pressable
              testID={testID}
              disabled={enabled === false}
              onPress={() => setExpanded(true)}
            >
              {children}
            </Pressable>
          </RNHostView>
        </JCDropdownMenu.Trigger>
        <JCDropdownMenu.Items>
          {visible.map((item) => (
            <JCDropdownMenuItem
              key={item.actionKey}
              enabled={!item.disabled}
              elementColors={{ textColor: item.destructive ? colors.destructive : undefined }}
              onClick={() => {
                setExpanded(false);
                // Best-effort guard. It does not currently stop the native press (see the defect
                // above), but it is the right expression of intent and starts working the moment
                // upstream honours `enabled` on the click path.
                if (item.disabled) return;
                const { icon: _icon, ...rest } = item;
                onItemPress?.(rest);
              }}
            >
              <JCDropdownMenuItem.Text>
                <JCText>
                  {item.subTitle ? `${item.title ?? ''} — ${item.subTitle}` : (item.title ?? '')}
                </JCText>
              </JCDropdownMenuItem.Text>
            </JCDropdownMenuItem>
          ))}
        </JCDropdownMenu.Items>
      </JCDropdownMenu>
    </JCHost>
  );
}

export { DropdownMenu };
