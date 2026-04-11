import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ConditionCard } from '../components/ConditionCard';
import { useTrailConditions } from '../hooks/useTrailConditions';

export function TrailConditionsScreen() {
  const router = useRouter();
  const { data: conditions, isLoading, refetch } = useTrailConditions();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>🥾 Trail Conditions</Text>
        <Text style={styles.subtitle}>Recent reports from the community</Text>
      </View>

      <TouchableOpacity
        style={styles.reportButton}
        onPress={() => router.push('/trail-conditions/report')}
      >
        <Text style={styles.reportButtonText}>+ Report Conditions</Text>
      </TouchableOpacity>

      <View style={styles.conditionsList}>
        {conditions?.map((condition) => (
          <ConditionCard key={condition.id} condition={condition} />
        ))}

        {conditions?.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No trail reports yet</Text>
            <Text style={styles.emptyStateSubtext}>Be the first to report conditions!</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 24,
    backgroundColor: '#f97316',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  reportButton: {
    backgroundColor: '#f97316',
    margin: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  reportButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  conditionsList: {
    padding: 16,
    paddingTop: 0,
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
});
