import { StyleSheet, Text, View } from 'react-native';
import type { TrailCondition } from '../types';
import { TrustBadge } from './TrustBadge';

interface ConditionCardProps {
  condition: TrailCondition;
}

const surfaceLabels: Record<string, string> = {
  paved: '🛣️ Paved',
  gravel: '🪨 Gravel',
  dirt: '🌲 Dirt',
  rocky: '⛰️ Rocky',
  snow: '❄️ Snow',
  mud: '💧 Mud',
};

const waterDepthLabels: Record<string, string> = {
  shallow: 'Shallow',
  moderate: 'Moderate',
  deep: 'Deep',
};

const waterDifficultyLabels: Record<string, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  difficult: 'Difficult',
};

export function ConditionCard({ condition }: ConditionCardProps) {
  const hazards: string[] = [];
  if (condition.hasFallenTrees) hazards.push('🌲 Fallen Trees');
  if (condition.hasWildlife) hazards.push('🦌 Wildlife');
  if (condition.hasErosion) hazards.push('🏔️ Erosion');
  if (condition.hasClosures) hazards.push('⛔ Closures');
  if (condition.hasWaterCrossings) hazards.push('💧 Water Crossings');

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.trailName}>{condition.trailName}</Text>
          {condition.locationName && (
            <Text style={styles.location}>📍 {condition.locationName}</Text>
          )}
        </View>
        <TrustBadge
          trustScore={condition.trustScore || 1}
          verifiedCount={condition.verifiedCount || 0}
        />
      </View>

      {condition.surfaceCondition && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Surface</Text>
          <Text style={styles.sectionText}>
            {surfaceLabels[condition.surfaceCondition] || condition.surfaceCondition}
          </Text>
        </View>
      )}

      {condition.difficulty && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Difficulty</Text>
          <Text style={styles.sectionText}>{'⭐'.repeat(condition.difficulty)}</Text>
        </View>
      )}

      {hazards.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hazards</Text>
          <View style={styles.hazardsContainer}>
            {hazards.map((hazard, index) => (
              <View key={index} style={styles.hazardBadge}>
                <Text style={styles.hazardText}>{hazard}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {condition.hasWaterCrossings && condition.waterCrossingCount && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Water Crossings</Text>
          <Text style={styles.sectionText}>
            {condition.waterCrossingCount} crossings
            {condition.waterDepth && ` • ${waterDepthLabels[condition.waterDepth]}`}
            {condition.waterDifficulty && ` • ${waterDifficultyLabels[condition.waterDifficulty]}`}
          </Text>
        </View>
      )}

      {condition.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.sectionText}>{condition.notes}</Text>
        </View>
      )}

      <Text style={styles.date}>
        Reported {new Date(condition.reportedAt).toLocaleDateString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
  },
  trailName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  location: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sectionText: {
    fontSize: 14,
    color: '#374151',
  },
  hazardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hazardBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  hazardText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '500',
  },
  date: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 12,
    textAlign: 'right',
  },
});
