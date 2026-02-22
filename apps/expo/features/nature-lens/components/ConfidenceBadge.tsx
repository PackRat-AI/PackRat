import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ConfidenceBadgeProps {
  confidence: number;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  let color = '#ef4444'; // red
  let label = 'Low';
  
  if (confidence >= 0.8) {
    color = '#22c55e'; // green
    label = 'High';
  } else if (confidence >= 0.5) {
    color = '#eab308'; // yellow
    label = 'Medium';
  }

  return (
    <View style={[styles.badge, { backgroundColor: color }]} >
      <Text style={styles.text}>{label} Confidence ({Math.round(confidence * 100)}%)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  text: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});
