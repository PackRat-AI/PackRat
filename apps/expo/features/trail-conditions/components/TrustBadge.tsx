import { StyleSheet, Text, View } from 'react-native';

interface TrustBadgeProps {
  trustScore: number;
  verifiedCount: number;
}

export function TrustBadge({ trustScore, verifiedCount }: TrustBadgeProps) {
  let color = '#ef4444';
  let label = 'New';

  if (trustScore >= 4) {
    color = '#22c55e';
    label = 'Verified';
  } else if (trustScore >= 2) {
    color = '#eab308';
    label = 'Trusted';
  }

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: color }]}>
        <Text style={styles.text}>{label}</Text>
      </View>
      {verifiedCount > 0 && <Text style={styles.verifiedText}>✓ {verifiedCount} verified</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  verifiedText: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '500',
  },
});
