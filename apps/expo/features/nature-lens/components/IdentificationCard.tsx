import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { ConfidenceBadge } from './ConfidenceBadge';
import { SafetyBadge } from './SafetyBadge';
import type { NatureIdentification } from '../types';

interface IdentificationCardProps {
  identification: NatureIdentification;
}

export function IdentificationCard({ identification }: IdentificationCardProps) {
  const categoryEmoji = {
    plant: '🌿',
    animal: '🦌',
    bird: '🦅',
    insect: '🦋',
    fungus: '🍄',
    other: '🌲',
  };

  return (
    <View style={styles.card}>
      {identification.imageUrl && (
        <Image source={{ uri: identification.imageUrl }} style={styles.image} />
      )}
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.emoji}>{categoryEmoji[identification.category]}</Text>
          <View style={styles.titleContainer}>
            <Text style={styles.commonName}>{identification.speciesCommonName}</Text>
            <Text style={styles.speciesName}>{identification.speciesName}</Text>
          </View>
        </View>

        <ConfidenceBadge confidence={identification.confidence} />
        
        <SafetyBadge 
          isEdible={identification.isEdible} 
          isDangerous={identification.isDangerous} 
        />

        {identification.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.sectionText}>{identification.description}</Text>
          </View>
        )}

        {identification.habitat && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Habitat</Text>
            <Text style={styles.sectionText}>{identification.habitat}</Text>
          </View>
        )}

        {identification.locationName && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <Text style={styles.sectionText}>{identification.locationName}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emoji: {
    fontSize: 32,
  },
  titleContainer: {
    flex: 1,
  },
  commonName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  speciesName: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#6b7280',
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  sectionText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});
