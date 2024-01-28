import React from 'react';
import { View, Platform } from 'react-native';
import { RText, RStack } from '@packrat/ui';
import { useSelector } from 'react-redux';
import useTheme from '../../hooks/useTheme';
import { theme } from '../../theme';
import useCustomStyles from 'app/hooks/useCustomStyles';
import { RootState } from 'store/store';

/**
 * Retrieves the appropriate container style based on the provided type.
 *
 * @param {string} type - The type of container style to retrieve.
 * @return {Object} The container style object.
 */
const getContainerStyle = (type) => {
  const styles = useCustomStyles(loadStyles);
  switch (type) {
    case 'search':
      return styles.searchContainer;
    case 'map':
      return styles.mapCard;
    case 'mobile':
      return styles.containerMobile;
    default:
      return styles.mutualStyles;
  }
};

/**
 * Generate the function comment for the given function body.
 *
 * @param {Object} props - The props object containing the function parameters.
 * @param {string} props.title - The title of the large card.
 * @param {React.Component} props.Icon - The icon component of the large card.
 * @param {React.Component} props.ContentComponent - The content component of the large card.
 * @param {Object} props.contentProps - The props object for the content component.
 * @param {string} props.type - The type of the large card.
 * @param {Object} props.customStyle - The custom style object for the large card.
 * @param {React.Component} props.children - The children components of the large card.
 * @return {React.Component} The rendered large card component.
 */
export default function LargeCard({
  title,
  Icon,
  ContentComponent,
  contentProps,
  type,
  customStyle,
  children,
}) {
  const currentShape = useSelector(
    (state: RootState) => state.search.selectedSearchResult,
  );
  const { enableDarkMode, enableLightMode, isDark, isLight, currentTheme } =
    useTheme();
  const containerStyle = customStyle || getContainerStyle(type);

  return (
    <RStack
      style={{
        alignSelf: 'center',
        width: '90%',
        borderRadius: 8,
        ...containerStyle,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          gap: 15,
          alignItems: 'center',
          paddingVertical: 15,
        }}
      >
        {Icon ? <Icon /> : null}
        <RText
          style={{
            color: currentTheme.colors.textPrimary,
            fontSize: currentTheme.font.size,
            fontWeight: '600',
          }}
        >
          {title && <RText>{title}</RText>}
        </RText>
      </View>
      {ContentComponent ? <ContentComponent {...contentProps} /> : null}
      {children}
    </RStack>
  );
}

const loadStyles = (theme) => {
  const { currentTheme } = theme;

  return {
    mutualStyles: {
      backgroundColor: currentTheme.colors.card,
      flex: 1,
      gap: 45,
      justifyContent: 'space-between',
      alignItems: 'center',
      textAlign: 'center',
      padding: currentTheme.size.cardPadding,
    },
    containerMobile: {
      backgroundColor: currentTheme.colors.card,
      padding: currentTheme.size.mobilePadding,
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 25,
      flex: 1,
      paddingHorizontal: 100,
    },
    searchContainer: {
      backgroundColor: currentTheme.colors.card,
      padding: currentTheme.size.mobilePadding,
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
      flex: 1,
      paddingHorizontal: 60,
      paddingVertical: 70,
      height: Platform.OS === 'web' ? 450 : '100%',
    },
    mapCard: {
      backgroundColor: currentTheme.colors.card,
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      padding: currentTheme.size.cardPadding,
      paddingHorizontal: currentTheme.padding.paddingInside,
      marginBottom: 20,
      height: Platform.OS === 'web' ? 650 : '100%',
      overflow: 'hidden',
    },
  };
};
