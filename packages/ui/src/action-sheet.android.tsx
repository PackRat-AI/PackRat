import type { ActionSheetOptions } from '@expo/react-native-action-sheet';
import {
  Column as JCColumn,
  ListItem as JCListItem,
  ModalBottomSheet as JCModalBottomSheet,
  Text as JCText,
} from '@expo/ui/jetpack-compose';
import { clickable, padding } from '@expo/ui/jetpack-compose/modifiers';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import * as React from 'react';
import { ThemedHost as JCHost } from './themed-host';

type Callback = (index?: number) => void;
type Request = { options: ActionSheetOptions; callback: Callback };

/**
 * MD3 modal bottom sheet behind `@expo/react-native-action-sheet`'s API, so every
 * `showActionSheetWithOptions` call site renders a Material sheet on Android unchanged.
 *
 * The cancel option is not drawn: an MD3 sheet is dismissed by the scrim, a drag or back, and each
 * of those reports the cancel index, as the library does. A destructive option is painted in the
 * error colour. Styling options the library accepts (`containerStyle`, `textStyle`, ...) are
 * ignored; the sheet takes its colours from the theme.
 *
 * The callback runs after the sheet is gone, so an alert or another sheet it opens is not raised
 * from inside a closing sheet (the nested-sheet case that silently failed to open in #2887).
 */
let present: ((request: Request) => void) | null = null;

function showActionSheetWithOptions(options: ActionSheetOptions, callback: Callback) {
  present?.({ options, callback });
}

function useActionSheet() {
  return { showActionSheetWithOptions };
}

function isDestructive({ options, index }: { options: ActionSheetOptions; index: number }) {
  const destructive = options.destructiveButtonIndex;
  return Array.isArray(destructive) ? destructive.includes(index) : destructive === index;
}

function ActionSheetHost() {
  const [request, setRequest] = React.useState<Request | null>(null);
  const { colors } = useColorScheme();

  React.useEffect(() => {
    present = setRequest;
    return () => {
      present = null;
    };
  }, []);

  if (!request) return null;
  const { options, callback } = request;

  function choose(index: number | undefined) {
    setRequest(null);
    setTimeout(() => callback(index), 0);
  }

  return (
    <JCHost matchContents>
      <JCModalBottomSheet
        containerColor={colors.card}
        onDismissRequest={() => choose(options.cancelButtonIndex)}
      >
        <JCColumn modifiers={[padding(0, 0, 0, 24)]}>
          {!!options.title && (
            <JCText
              style={{ typography: 'titleMedium' }}
              color={colors.foreground}
              modifiers={[padding(16, 0, 16, options.message ? 4 : 8)]}
            >
              {options.title}
            </JCText>
          )}
          {!!options.message && (
            <JCText
              style={{ typography: 'bodyMedium' }}
              color={colors.grey}
              modifiers={[padding(16, 0, 16, 8)]}
            >
              {options.message}
            </JCText>
          )}
          {options.options.map((label, index) =>
            index === options.cancelButtonIndex ? null : (
              <JCListItem
                key={`${index}-${label}`}
                colors={{
                  containerColor: colors.card,
                  contentColor: isDestructive({ options, index })
                    ? colors.destructive
                    : colors.foreground,
                }}
                modifiers={[clickable(() => choose(index))]}
              >
                <JCListItem.HeadlineContent>
                  <JCText
                    color={
                      isDestructive({ options, index }) ? colors.destructive : colors.foreground
                    }
                  >
                    {label}
                  </JCText>
                </JCListItem.HeadlineContent>
              </JCListItem>
            ),
          )}
        </JCColumn>
      </JCModalBottomSheet>
    </JCHost>
  );
}

export { ActionSheetHost, useActionSheet };
