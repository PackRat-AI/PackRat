import * as DropdownMenuPrimitive from '@rn-primitives/dropdown-menu';
import { useAugmentedRef } from '@rn-primitives/hooks';
import { Icon } from 'expo-app/components/Icon';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import * as React from 'react';
import { Image, type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeOut,
  FadeOutLeft,
  LayoutAnimationConfig,
  LinearTransition,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../button';
import { ActivityIndicator } from '../loading-indicator';
import { Text } from '../text';
import type {
  DropdownItem,
  DropdownMenuMethods,
  DropdownMenuProps,
  DropdownSubMenu,
} from './types';

// Plain RN composition — DropdownMenu never needed a Host bridge, it already wrapped
// @rn-primitives/dropdown-menu (an unstyled RN primitive, not @expo/ui). Ported directly.

const DropdownContext = React.createContext<{
  onItemPress: DropdownMenuProps['onItemPress'];
  dismissMenu?: () => void;
  materialLoadingText: string;
  materialSubMenuTitlePlaceholder: string;
  subMenuRefs: React.RefObject<DropdownMenuMethods[]>;
  closeSubMenus: () => void;
} | null>(null);

function DropdownMenu({
  ref,
  items,
  title,
  iOSItemSize: _iOSItemSize,
  onItemPress: onItemPressProp,
  enabled: _enabled = true,
  children,
  materialPortalHost,
  materialSideOffset = 2,
  materialAlignOffset,
  materialAlign = 'center',
  materialWidth,
  materialMinWidth = 200,
  materialLoadingText = 'Loading...',
  materialSubMenuTitlePlaceholder = 'More ...',
  materialOverlayClassName,
  ...props
}: DropdownMenuProps & { materialIsSubMenu?: boolean }) {
  const { materialIsSubMenu, ...rootProps } = props;
  const triggerRef = React.useRef<DropdownMenuPrimitive.TriggerRef>(null);
  const subMenuRefs = React.useRef<DropdownMenuMethods[]>([]);
  const insets = useSafeAreaInsets();
  const rootRef = useAugmentedRef({
    ref: ref as React.Ref<DropdownMenuMethods>,
    methods: {
      presentMenu: () => triggerRef.current?.open(),
      dismissMenu,
    },
    deps: [triggerRef.current],
  });

  function closeSubMenus() {
    for (const subMenuRef of subMenuRefs.current) {
      subMenuRef.dismissMenu?.();
    }
  }

  function onItemPress(item: Omit<DropdownItem, 'icon'>) {
    closeSubMenus();
    onItemPressProp?.(item);
  }

  function dismissMenu() {
    triggerRef.current?.close();
  }

  return (
    <DropdownMenuPrimitive.Root
      // @rn-primitives/hooks' useAugmentedRef merges imperative `methods` onto the forwarded
      // View ref at runtime; the return type doesn't reflect that (documented pattern, same
      // gap as alert.tsx's AlertDialogPrimitive.Root ref).
      ref={rootRef as unknown as React.RefObject<DropdownMenuPrimitive.RootRef>}
      {...rootProps}
    >
      <DropdownMenuPrimitive.Trigger ref={triggerRef} asChild>
        {children}
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal hostName={materialPortalHost}>
        <DropdownContext.Provider
          value={{
            onItemPress,
            dismissMenu,
            materialLoadingText,
            materialSubMenuTitlePlaceholder,
            subMenuRefs,
            closeSubMenus,
          }}
        >
          <DropdownMenuPrimitive.Overlay
            style={StyleSheet.absoluteFill}
            pointerEvents={materialIsSubMenu ? 'box-none' : undefined}
          >
            <Animated.View
              style={StyleSheet.absoluteFill}
              entering={FadeIn}
              exiting={FadeOut}
              pointerEvents={materialIsSubMenu ? 'box-none' : undefined}
              className={cn(
                !materialIsSubMenu && 'bg-black/20',
                !materialIsSubMenu && materialOverlayClassName,
              )}
            >
              <DropdownMenuPrimitive.Content
                insets={{ top: insets.top, right: 8, bottom: insets.bottom, left: 8 }}
                sideOffset={materialSideOffset}
                alignOffset={materialAlignOffset}
                align={materialAlign}
              >
                <Animated.View
                  entering={FadeIn}
                  exiting={materialIsSubMenu ? undefined : FadeOut}
                  style={{ minWidth: materialMinWidth, width: materialWidth }}
                  className="border-border/20 bg-card z-50 rounded-md border py-2 shadow-xl"
                >
                  {!!title && <DropdownMenuLabel>{title}</DropdownMenuLabel>}
                  <DropdownMenuInnerContent items={items} />
                </Animated.View>
              </DropdownMenuPrimitive.Content>
            </Animated.View>
          </DropdownMenuPrimitive.Overlay>
        </DropdownContext.Provider>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

DropdownMenu.displayName = 'DropdownMenu';

export { DropdownMenu };

function useDropdownContext() {
  const context = React.useContext(DropdownContext);
  if (!context) {
    throw new Error(
      'DropdownMenu compound components cannot be rendered outside the DropdownMenu component',
    );
  }
  return context;
}

function DropdownMenuInnerContent({ items }: { items: (DropdownItem | DropdownSubMenu)[] }) {
  const { materialLoadingText } = useDropdownContext();
  const id = React.useId();

  return (
    <View>
      {items.map((item, index) => {
        if (item.loading) {
          return (
            <DropdownMenuPrimitive.Item key={`loading:${id}-${item.title}-${index}`} asChild>
              <Button
                disabled
                variant="plain"
                className="h-12 justify-between gap-10 rounded-none px-3"
                androidRootClassName="rounded-none"
              >
                <Text className="font-normal opacity-60">{materialLoadingText}</Text>
                <ActivityIndicator />
              </Button>
            </DropdownMenuPrimitive.Item>
          );
        }
        if ((item as Partial<DropdownSubMenu>)?.items) {
          const subMenu = item as DropdownSubMenu;
          if (subMenu.items.length === 0) return null;
          return (
            <React.Fragment key={`${id}-${subMenu.title}-${index}`}>
              <DropdownMenuSubMenu
                title={subMenu.title}
                subTitle={subMenu.subTitle}
                items={subMenu.items}
              />
            </React.Fragment>
          );
        }
        const dropdownItem = item as DropdownItem;
        return (
          <React.Fragment key={dropdownItem.actionKey}>
            <DropdownMenuItem {...dropdownItem} />
          </React.Fragment>
        );
      })}
    </View>
  );
}

function DropdownMenuLabel(props: { children: React.ReactNode }) {
  return (
    <DropdownMenuPrimitive.Label className="text-muted-foreground/80 border-border/25 dark:border-border/80 dark:text-muted-foreground border-b px-3 pb-2 text-sm">
      {props.children}
    </DropdownMenuPrimitive.Label>
  );
}

function DropdownMenuItem(props: Omit<DropdownItem, 'loading'>) {
  const { colors } = useColorScheme();
  const { onItemPress } = useDropdownContext();

  function onPress() {
    onItemPress?.(props);
  }

  if (props.hidden) return null;

  return (
    <LayoutAnimationConfig skipEntering skipExiting>
      <DropdownMenuPrimitive.Item
        asChild
        closeOnPress={!props.keepOpenOnPress}
        role="checkbox"
        accessibilityState={{ disabled: !!props.disabled, checked: props.state?.checked }}
      >
        <Button
          variant={props.state?.checked ? 'tonal' : 'plain'}
          className={cn(
            'h-12 justify-between gap-10 rounded-none px-3',
            !props.state && !props.title && 'justify-center px-4',
          )}
          androidRootClassName="rounded-none"
          accessibilityHint={props.subTitle}
          onPress={onPress}
        >
          {!props.state && !props.title ? null : (
            <View className="flex-row items-center gap-3 py-0.5">
              {props.state?.checked && (
                <Animated.View entering={FadeInLeft} exiting={FadeOutLeft}>
                  <Icon name="check" color={colors.foreground} size={20} />
                </Animated.View>
              )}
              <Animated.View layout={LinearTransition}>
                <Text
                  numberOfLines={1}
                  className={cn(
                    'font-normal',
                    props.destructive && 'text-destructive font-medium',
                    props.disabled && 'opacity-60',
                  )}
                >
                  {props.title}
                </Text>
              </Animated.View>
              {props.state && !props.state?.checked && (
                <Icon name="check" color="transparent" size={20} />
              )}
            </View>
          )}
          {props.image ? (
            <Image
              source={{ uri: props.image.url }}
              style={{
                width: 22,
                height: 22,
                borderRadius:
                  typeof props.image.cornerRadius === 'number' && props.image.cornerRadius > 0
                    ? props.image.cornerRadius / 4
                    : 0,
              }}
            />
          ) : props.icon ? (
            <Icon name={props.icon.name} color={props.icon.color ?? colors.foreground} size={22} />
          ) : null}
        </Button>
      </DropdownMenuPrimitive.Item>
    </LayoutAnimationConfig>
  );
}

const DEFAULT_LAYOUT = { width: 0, height: 0 };

function DropdownMenuSubMenu({ title, subTitle, items }: Omit<DropdownSubMenu, 'loading'>) {
  const {
    onItemPress: onDropdownItemPress,
    dismissMenu,
    materialSubMenuTitlePlaceholder,
    subMenuRefs,
    closeSubMenus,
  } = useDropdownContext();
  const [triggerLayout, setTriggerLayout] = React.useState<typeof DEFAULT_LAYOUT>(DEFAULT_LAYOUT);
  const { colors } = useColorScheme();

  function onItemPress(item: Omit<DropdownItem, 'icon'>) {
    dismissMenu?.();
    onDropdownItemPress?.(item);
  }

  function onLayout(ev: LayoutChangeEvent) {
    setTriggerLayout(ev.nativeEvent.layout);
  }

  function addSubMenuRef(subMenuRef?: DropdownMenuMethods | null) {
    if (!subMenuRef) return;
    subMenuRefs.current.push(subMenuRef);
  }

  return (
    <DropdownMenu
      items={items}
      materialAlign="start"
      materialSideOffset={-triggerLayout.height}
      materialAlignOffset={triggerLayout.width}
      onItemPress={onItemPress}
      materialMinWidth={48}
      materialIsSubMenu
      ref={addSubMenuRef as unknown as React.Ref<DropdownMenuMethods>}
    >
      <Button
        variant="plain"
        className="justify-between gap-10 rounded-none px-3"
        androidRootClassName="rounded-none"
        onLayout={onLayout}
        accessibilityHint={subTitle}
        onPress={closeSubMenus}
      >
        <Text numberOfLines={1} className="py-0.5 font-normal">
          {title || materialSubMenuTitlePlaceholder}
        </Text>
        <Icon name="chevron-right" color={colors.grey} size={20} />
      </Button>
    </DropdownMenu>
  );
}
