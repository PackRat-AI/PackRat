const loadStyles = (theme: any) => {
  const { currentTheme } = theme;
  return {
    container: {
      flex: 1,
      backgroundColor: currentTheme.colors.background,
      alignItems: 'center',
    },
    containerDark: {
      flex: 1,
      backgroundColor: currentTheme.colors.background,
      alignItems: 'center',
    },
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      justifyContent: 'center',
    },
    header: {
      fontSize: 24,
      fontWeight: 'bold',
      color: currentTheme.colors.text,
      marginRight: 10,
    },
    headerDark: {
      fontSize: 24,
      fontWeight: 'bold',
      color: currentTheme.colors.white,
      marginRight: 10,
    },

    buttonContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      marginBottom: 70,
    },

    githubButton: {
      flexDirection: 'row',
      alignItems: 'center',
      // backgroundColor: theme.colors.primary,
      margin: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 4,
      backgroundColor: '#24292E',
    },
    discordButton: {
      flexDirection: 'row',
      alignItems: 'center',
      // backgroundColor: theme.colors.primary,
      margin: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 4,
      backgroundColor: '#7289DA',
    },
    githubIcon: {
      fontSize: 24,
      color: currentTheme.colors.white,
      marginRight: 5,
    },
    githubIconDark: {
      fontSize: 24,
      color: currentTheme.colors.white,
      marginRight: 5,
    },
    githubText: {
      fontSize: 18,
      color: currentTheme.colors.white,
    },
    githubtertiaryBlue: {
      fontSize: 18,
      color: currentTheme.colors.white,
    },
    textContainer: {
      marginBottom: 20,
    },
    text: {
      fontSize: 18,
      lineHeight: 28,
      letterSpacing: 1,
      // fontFamily: "sans-serif",
      color: currentTheme.colors.text,
      marginBottom: 20,
    },
    tertiaryBlue: {
      fontSize: 18,
      lineHeight: 28,
      letterSpacing: 1,
      // fontFamily: "sans-serif",
      color: currentTheme.colors.white,
      marginBottom: 20,
    },
    logoContainer: {
      width: '50%',
      height: 'auto',
    },
    webLogoContainer: {
      width: '25%',
      height: 'auto',
      alignSelf: 'center',
      justifyContent: 'center',
    },
    mobileContainer: {
      width: '50%',
      height: 'auto',
      alignSelf: 'center',
    },
    mobileLogo: {
      width: 160,
      height: 150,
      alignSelf: 'center',
    },
    logo: {
      width: '100%',
      height: 'auto',
      alignSelf: 'center',
    },
  };
};

export default loadStyles;
