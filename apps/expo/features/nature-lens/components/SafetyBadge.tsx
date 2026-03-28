import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SafetyBadgeProps {
  isEdible?: boolean;
  isDangerous?: boolean;
}

export function SafetyBadge({ isEdible, isDangerous }: SafetyBadgeProps) {
  if (isDangerous) {
    return (
      <View style={[styles.badge, styles.dangerous]} >
        <Text style={styles.text}>⚠️ Dangerous/Poisonous</Text>
      </View>
    );
  }

  if (isEdible === true) {
    return (
      <View style={[styles.badge, styles.edible]} >
        <Text style={styles.text}>✓ Edible</Text>
      </View>
    );
  }

  if (isEdible === false) {
    return (
      <View style={[styles.badge, styles.notEdible]} >
        <Text style={styles.text}>Not Edible</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  dangerous: {
    backgroundColor: '#dc2626',
  },
  edible: {
    backgroundColor: '#16a34a',
  },
  notEdible: {
    backgroundColor: '#6b7280',
  },
  text: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});
