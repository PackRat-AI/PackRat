import { isNumber } from '@packrat/guards';
import * as ContextMenuPrimitive from '@rn-primitives/context-menu';
import { useAugmentedRef, useRelativePosition } from '@rn-primitives/hooks';
import { Icon } from 'expo-app/components/Icon';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import * as Haptics from 'expo-haptics';
import * as React from 'react';
import {
  Image,
  type LayoutChangeEvent,
  type LayoutRectangle,
  Pressable,
  StyleSheet,
  View,
  type ViewProps,
} from 'react-native';
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
import { DropdownMenu } from '../dropdown-menu';
import { Text } from '../text';
import type { ContextItem, ContextMenuMethods, ContextMenuProps, ContextSubMenu } from './types';

// Plain RN composition — ContextMenu never needed a Host bridge, it already wrapped
// @rn-primitives/context-menu (an unstyled RN primitive, not @expo/ui). Ported directly.

const ContextMenuContext = React.createContext<{
  onItemPress: ContextMenuProps['onItemPress'];
  dismissMenu?: () => void;
  materialLoadingText: string;
  materialSubMenuTitlePlaceholder: string;
  subMenuRefs: React.RefObject<ContextMenuMethods[]>;
  closeSubMenus: () => void;
} | null>(null);

const ROOT_DEFAULT_LAYOUT = { height: 0, width: 0, pageX: 0, pageY: 0 };

function ContextMenu({
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
  iosRenderPreview: _iosRenderPreview,
  iosOnPressMenuPreview: _iosOnPressMenuPreview,
  iosPreviewConfig: _iosPreviewConfig,
  renderAuxiliaryPreview,
  auxiliaryPreviewPosition = 'start',
  materialOverlayClassName,
  ...props
}: ContextMenuProps) {
  const [rootLayout, setRootLayout] = React.useState(ROOT_DEFAULT_LAYOUT);
  const [auxiliaryContentLayout, setAuxiliaryContentLayout] =
    React.useState<LayoutRectangle | null>(null);
  const [contentLayout, setContentLayout] = React.useState<LayoutRectangle | null>(null);
  const subMenuRefs = React.useRef<ContextMenuMethods[]>([]);
  const insets = useSafeAreaInsets();
  const triggerRef = React.useRef<ContextMenuPrimitive.TriggerRef>(null);
  const rootRef = useAugmentedRef({
    ref: ref as React.Ref<ContextMenuMethods>,
    methods: {
      presentMenu: () => triggerRef.current?.open(),
      dismissMenu,
    },
    deps: [triggerRef.current],
  });

  const positionStyle = useRelativePosition({
    align: auxiliaryPreviewPosition,
    avoidCollisions: true,
    triggerPosition: rootLayout,
    contentLayout: auxiliaryContentLayout,
    alignOffset: 0,
    insets: {
      top: insets.top,
      right: 8,
      bottom: insets.bottom + (contentLayout?.height ?? 0),
      left: 8,
    },
    sideOffset: 4,
    side: 'top',
    disablePositioningStyle: false,
  });

  function onLayout(event: LayoutChangeEvent) {
    setAuxiliaryContentLayout(event.nativeEvent.layout);
  }

  function onTriggerLongPress() {
    // biome-ignore lint/complexity/useMaxParams: RN core's View.measure callback signature, not ours to restructure
    (rootRef.current as unknown as View)?.measure((_x, _y, width, height, pageX, pageY) => {
      setRootLayout({ height, width, pageX, pageY });
    });
  }

  function closeSubMenus() {
    for (const subMenuRef of subMenuRefs.current) {
      subMenuRef.dismissMenu?.();
    }
  }

  function onItemPress(item: Omit<ContextItem, 'icon'>) {
    closeSubMenus();
    onItemPressProp?.(item);
  }

  function dismissMenu() {
    triggerRef.current?.close();
  }

  function onOpenChange(open: boolean) {
    if (!open) {
      setAuxiliaryContentLayout(null);
      setContentLayout(null);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function onContentLayout(ev: LayoutChangeEvent) {
    setContentLayout(ev.nativeEvent.layout);
  }

  return (
    <View>
      <ContextMenuPrimitive.Root
        // Same useAugmentedRef typing gap as alert.tsx/dropdown-menu.tsx — methods are merged
        // onto the forwarded View ref at runtime, but the return type doesn't reflect that.
        ref={rootRef as unknown as React.RefObject<ContextMenuPrimitive.RootRef>}
        relativeTo="trigger"
        onOpenChange={onOpenChange}
        {...props}
        collapsable={false}
      >
        <ContextMenuPrimitive.Trigger ref={triggerRef} onLongPress={onTriggerLongPress} asChild>
          {children}
        </ContextMenuPrimitive.Trigger>
        <ContextMenuPrimitive.Portal hostName={materialPortalHost}>
          <ContextMenuContext.Provider
            value={{
              onItemPress,
              dismissMenu,
              materialLoadingText,
              materialSubMenuTitlePlaceholder,
              subMenuRefs,
              closeSubMenus,
            }}
          >
            <ContextMenuPrimitive.Overlay style={StyleSheet.absoluteFill}>
              <Animated.View
                style={StyleSheet.absoluteFill}
                entering={FadeIn}
                exiting={FadeOut}
                className={cn('bg-black/20', materialOverlayClassName)}
              >
                {renderAuxiliaryPreview && contentLayout && (
                  <ContextMenuAuxiliaryPreview onLayout={onLayout} style={positionStyle}>
                    {renderAuxiliaryPreview()}
                  </ContextMenuAuxiliaryPreview>
                )}
                <ContextMenuPrimitive.Content
                  insets={{ top: insets.top, right: 8, bottom: insets.bottom, left: 8 }}
                  sideOffset={materialSideOffset}
                  alignOffset={materialAlignOffset}
                  align={materialAlign}
                  className={cn(!title && items.length === 0 && 'opacity-0')}
                  pointerEvents={!title && items.length === 0 ? 'none' : undefined}
                  onLayout={onContentLayout}
                >
                  <Animated.View
                    entering={FadeIn}
                    exiting={FadeOut}
                    style={{ minWidth: materialMinWidth, width: materialWidth }}
                    className="border-border/20 bg-card z-50 rounded-md border py-2 shadow-xl"
                  >
                    {!!title && <ContextMenuLabel>{title}</ContextMenuLabel>}
                    <ContextMenuInnerContent items={items} />
                  </Animated.View>
                </ContextMenuPrimitive.Content>
              </Animated.View>
            </ContextMenuPrimitive.Overlay>
          </ContextMenuContext.Provider>
        </ContextMenuPrimitive.Portal>
      </ContextMenuPrimitive.Root>
    </View>
  );
}

export { ContextMenu };

function useContextMenuContext() {
  const context = React.useContext(ContextMenuContext);
  if (!context) {
    throw new Error(
      'ContextMenu compound components cannot be rendered outside the ContextMenu component',
    );
  }
  return context;
}

function ContextMenuAuxiliaryPreview({
  style,
  onLayout,
  children,
}: Required<Pick<ViewProps, 'style' | 'onLayout' | 'children'>>) {
  return (
    <Pressable style={style} onLayout={onLayout}>
      {children}
    </Pressable>
  );
}

function ContextMenuInnerContent({ items }: { items: (ContextItem | ContextSubMenu)[] }) {
  const { materialLoadingText } = useContextMenuContext();
  const id = React.useId();

  return (
    <View>
      {items.map((item, index) => {
        if (item.loading) {
          return (
            <ContextMenuPrimitive.Item key={`loading:${id}-${item.title}-${index}`} asChild>
              <Button
                disabled
                variant="plain"
                className="h-12 justify-between gap-10 rounded-none px-3"
                androidRootClassName="rounded-none"
              >
                <Text className="font-normal opacity-60">{materialLoadingText}</Text>
              </Button>
            </ContextMenuPrimitive.Item>
          );
        }
        if ((item as Partial<ContextSubMenu>)?.items) {
          const subMenu = item as ContextSubMenu;
          if (subMenu.items.length === 0) return null;
          return (
            <React.Fragment key={`${id}-${subMenu.title}-${index}`}>
              <ContextMenuSubMenu
                title={subMenu.title}
                subTitle={subMenu.subTitle}
                items={subMenu.items}
              />
            </React.Fragment>
          );
        }
        const contextMenuItem = item as ContextItem;
        return (
          <React.Fragment key={contextMenuItem.actionKey}>
            <ContextMenuItem {...contextMenuItem} />
          </React.Fragment>
        );
      })}
    </View>
  );
}

function ContextMenuLabel(props: { children: React.ReactNode }) {
  return (
    <ContextMenuPrimitive.Label className="text-muted-foreground/80 border-border/25 dark:border-border/80 dark:text-muted-foreground border-b px-3 pb-2 text-sm">
      {props.children}
    </ContextMenuPrimitive.Label>
  );
}

function ContextMenuItem(props: Omit<ContextItem, 'loading'>) {
  const { colors } = useColorScheme();
  const { onItemPress } = useContextMenuContext();

  function onPress() {
    onItemPress?.(props);
  }

  if (props.hidden) return null;

  return (
    <LayoutAnimationConfig skipEntering skipExiting>
      <ContextMenuPrimitive.Item
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
                  <Icon name="check" size={21} color={colors.foreground} />
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
                <Icon name="check" size={21} color="transparent" />
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
                  isNumber(props.image.cornerRadius) && props.image.cornerRadius > 0
                    ? props.image.cornerRadius / 4
                    : 0,
              }}
            />
          ) : props.icon ? (
            <Icon name={props.icon.name} color={props.icon.color ?? colors.foreground} size={22} />
          ) : null}
        </Button>
      </ContextMenuPrimitive.Item>
    </LayoutAnimationConfig>
  );
}

const DEFAULT_LAYOUT = { width: 0, height: 0 };

function ContextMenuSubMenu({ title, subTitle, items }: Omit<ContextSubMenu, 'loading'>) {
  const { colors } = useColorScheme();
  const {
    onItemPress: onContextMenuItemPress,
    dismissMenu,
    materialSubMenuTitlePlaceholder,
    subMenuRefs,
    closeSubMenus,
  } = useContextMenuContext();
  const [triggerLayout, setTriggerLayout] = React.useState<typeof DEFAULT_LAYOUT>(DEFAULT_LAYOUT);

  function onItemPress(item: Omit<ContextItem, 'icon'>) {
    dismissMenu?.();
    onContextMenuItemPress?.(item);
  }

  function onLayout(ev: LayoutChangeEvent) {
    setTriggerLayout(ev.nativeEvent.layout);
  }

  function addSubMenuRef(subMenuRef: ContextMenuMethods | null) {
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
      ref={addSubMenuRef as unknown as React.Ref<ContextMenuMethods>}
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
        <Icon name="chevron-right" size={21} color={colors.grey} />
      </Button>
    </DropdownMenu>
  );
}
