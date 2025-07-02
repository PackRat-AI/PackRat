import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

export const BackButton = ({ onPress }: { onPress: () => void }) => {
  return (
    <View style={styles.backButton}>
      <Feather name="chevron-left" size={16} color="#007AFF" />
      <Text style={styles.backButtonText} onPress={onPress}>
        Back
      </Text>
    </View>
  );
};
const styles = StyleSheet.create({
  backButton: {
    flexDirection: 'row',
    paddingLeft: 20,
  },
  backButtonText: {
    color: '#007AFF',
    marginLeft: 4,
  },
});
