import { Platform } from 'react-native';
const isWeb = Platform.OS === 'web';
const loadStyles = (theme) => {
  const { currentTheme } = theme;

  return {
    container: {
      flex: 1,
      padding: 10,
      width: Platform.OS === 'web' ? '100%' : 310,
    },
    tableStyle: {
      width: '100%',
      marginVertical: 20,
    },
    mainTitle: {
      marginTop: 10,
      marginBottom: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryRow: {
      padding: 10,
      borderRadius: isWeb ? 5 : 0,
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    title: {
      height: 50,
      backgroundColor: currentTheme.colors.primary,
      borderRadius: 2,
      justifyContent: 'center',
      paddingLeft: 15,
    },
    titleText: {
      fontWeight: 'bold',
      color: 'white',
    },
    head: {
      height: 50,
      borderBottomWidth: 1,
      borderBottomColor: currentTheme.colors.border,
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
    },
    headerText: {
      fontWeight: 'bold',
      color:
        currentTheme.colors.background === '#1A1A1D'
          ? currentTheme.colors.text
          : 'black',
      fontSize: Platform.OS === 'web' ? 14 : 12,
    },
    row: {
      flexDirection: 'row',
      height: 60,
      alignItems: 'center',
      // color: currentTheme.colors.text,
      backgroundColor:
        currentTheme.colors.background === '#1A1A1D'
          ? currentTheme.colors.black
          : currentTheme.colors.white,
      borderBottomWidth: 1,
      borderBottomColor: currentTheme.colors.border,
    },
    infoContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: 25,
      backgroundColor: currentTheme.colors.white,
    },
    noItemsText: {
      fontWeight: 'bold',
      fontSize: 16,
      margin: 20,
      textAlign: 'center',
    },
    totalWeightBox: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: Platform.OS === 'web' ? '100%' : 300,
      paddingHorizontal: 25,
      marginVertical: 30,
      flex: 1,
    },
  };
};

export default loadStyles;
