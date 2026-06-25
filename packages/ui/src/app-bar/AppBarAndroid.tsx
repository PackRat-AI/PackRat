import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACTION_ROW_HEIGHT = 64;
const TITLE_ROW_HEIGHT = 72;

type AppBarAndroidProps = {
  back?: { title?: string };
  options: {
    title?: string;
    headerRight?: (props: { tintColor?: string; canGoBack?: boolean }) => React.ReactNode;
  };
  navigation: { goBack: () => void };
};

export function AppBarAndroid({ back, options, navigation }: AppBarAndroidProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useColorScheme();
  const canGoBack = !!back;

  return (
    <View
      style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}
    >
      <View style={styles.actionRow}>
        {canGoBack && (
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.navButton}>
            <Icon
              name="arrow-left"
              size={28}
              color={colors.foreground}
              materialIcon={{ name: 'arrow-back', type: 'MaterialIcons' }}
            />
          </Pressable>
        )}
        <View style={styles.flex} />
        {options.headerRight?.({ tintColor: colors.foreground, canGoBack })}
      </View>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          {options.title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  actionRow: {
    height: ACTION_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  navButton: { padding: 14 },
  flex: { flex: 1 },
  titleRow: {
    height: TITLE_ROW_HEIGHT,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: { fontSize: 32, fontWeight: '400', letterSpacing: 0 },
});
