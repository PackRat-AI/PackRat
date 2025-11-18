import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { StyleSheet, Text, View } from 'react-native';

export const BackButton = ({ onPress }: { onPress: () => void }) => {
  const { t } = useTranslation();
  
  return (
    <View style={styles.backButton}>
      <Feather name="chevron-left" size={16} color="#007AFF" />
      <Text style={styles.backButtonText} onPress={onPress}>
        {t('common.back')}
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
