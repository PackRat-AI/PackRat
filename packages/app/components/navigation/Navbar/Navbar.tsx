import React, { useContext, useMemo } from 'react';
import { View, Text, SafeAreaView, StyleSheet, Platform } from 'react-native';
import { RButton, Container, RIconButton } from '@packrat/ui';
import { useNavigate } from 'app/hooks/navigation';
import { Drawer } from '../Drawer';
import { useScrollTop } from 'app/hooks/common/useScrollTop';
import { useScreenWidth } from 'app/hooks/common';
import { RImage } from '@packrat/ui';
import Feather from '@expo/vector-icons/Feather';
import ThemeContext from '../../../context/theme';

export const Navbar = () => {
  const { currentTheme, isDark, enableDarkMode, enableLightMode } =
    useContext(ThemeContext);
  const scrollTop = useScrollTop();
  const { screenWidth } = useScreenWidth();
  const isScrolled = !!scrollTop;
  const styles = useMemo(() => {
    return StyleSheet.create(loadStyles(currentTheme, isScrolled, screenWidth));
  }, [isScrolled, currentTheme, screenWidth]);
  const navigate = useNavigate();

  const iconName = isDark ? 'moon' : 'sun';
  const iconColor = isDark ? 'white' : 'black';
  const handlePress = () => {
    if (isDark) {
      enableLightMode();
    } else {
      enableDarkMode();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Container>
        <View style={styles.container}>
          <View style={styles.logoContainer}>
            <RImage
              source={{
                // TODO: Update this to use the PackRat logo from the assets folder
                uri: 'https://github.com/andrew-bierman/PackRat/blob/main/packages/app/assets/packrat_icon.png?raw=true',
                width: 40,
                height: 40,
              }}
              width={40}
              height={40}
              style={styles.logo}
              alt="PackRat Logo"
              onClick={() => {
                navigate('/');
              }}
            />
            <Text
              style={styles.logoText}
              onPress={() => {
                navigate('/');
              }}
            >
              PackRat
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              display: 'flex',
            }}
          >
            <RIconButton
              backgroundColor="transparent"
              icon={<Feather name={iconName} size={24} color={iconColor} />}
              onPress={handlePress}
            />
            <Drawer />
          </View>
        </View>
      </Container>
    </SafeAreaView>
  );
};

const NavbarStyles = {
  floatingBg: '#cce5ff',
  floatingRadius: 25,
  floatingBlur: 'blur(2px)',
  transition: 'all 0.2s ease-in-out',
  floatingSpacing: 4,
};

const loadStyles = (currentTheme, isScrolled, screenWidth) => {
  const isWeb = Platform.OS === 'web';
  const isFloating = isWeb && isScrolled;
  const backgroundColor = isFloating
    ? currentTheme.colors.border
    : currentTheme.colors.background;

  return StyleSheet.create({
    drawerStyles: {
      backgroundColor: currentTheme.colors.background,
    },
    safeArea: {
      backgroundColor,
      width: '100%',
      margin: 0,
      transition: NavbarStyles.transition,
      ...Platform.select({
        web: {
          ...(isFloating
            ? {
                backdropFilter: NavbarStyles.floatingBlur,
                marginTop: NavbarStyles.floatingSpacing,
                padding: NavbarStyles.floatingSpacing,
                borderRadius: NavbarStyles.floatingRadius,
              }
            : {}),
          position: 'fixed' as 'fixed' | 'relative',
          top: 0,
          zIndex: 100,
          width: Platform.OS === 'web' ? '100vw' : '100%',
        },
      }),
    } as any,
    container: {
      width: '100vw',
      maxWidth: 1440,
      margin: 'auto',
      flex: 1, // Ensure container can grow to fit content
      backgroundColor,
      borderRadius: NavbarStyles.floatingRadius,
      flexDirection: 'row', // Keep flexDirection as row for alignment
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap', // Allow items to wrap
      height: 60, // Ensure container takes full height of its container
      padding: 16,
    } as any,
    header: {
      flexDirection: 'row', // Keep flexDirection as row for initial alignment
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%', // Ensure header takes full width of its container
      flexWrap: 'wrap', // Allow header items to wrap
    },
    logoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    logo: {
      marginRight: 10,
      cursor: 'pointer',
      backgroundColor: currentTheme.colors.tertiaryBlue,
      borderRadius: 10,
    } as any,
    logoText: {
      color: currentTheme.colors.tertiaryBlue,
      fontSize: 38,
      fontWeight: '900',
      cursor: 'pointer',
    } as any,
    menuBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      flex: 1, // Keep flexible but consider its behavior with wrapping,
      flexWrap: 'wrap', // Allow items to wrap
    },
    drawerTrigger: {},
    menuBarItemActive: {
      // Apply styles for the active item
      // ...
    },
    menuBarItemTextActive: {
      // Apply styles for the active item's text
      // ...
    },
    menuBarItemSelected: {
      // Apply styles for the selected item
      // ...
    },
    menuBarItemTextSelected: {
      // Apply styles for the selected item's text
      // ...
    },
  });
};
