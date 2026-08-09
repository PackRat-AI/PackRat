import type { TextInput, TextInputProps } from 'react-native';

type SearchInputRef = React.Ref<TextInput>;

type SearchInputProps = TextInputProps & {
  ref?: SearchInputRef;
  containerClassName?: string;
  iconContainerClassName?: string;
  cancelText?: string;
  iconColor?: string;
  /** testID applied to the outer container (the accessibility leaf). Use for Maestro/XCTest targeting instead of testID, which only reaches the inner TextInput. */
  containerTestID?: string;
  /** accessibilityLabel applied to the outer container. */
  containerAccessibilityLabel?: string;
};

export type { SearchInputProps, SearchInputRef };
