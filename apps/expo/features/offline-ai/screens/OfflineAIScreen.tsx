/**
 * Offline AI Screen
 *
 * Full screen view for the offline AI assistant feature.
 */

import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { OfflineAIChat } from '../components/OfflineAIChat';
import type { TrailInfo } from '../types';

// Sample trail for demo
const DEMO_TRAIL: TrailInfo = {
  id: 'demo-trail',
  name: 'Angels Landing',
  location: 'Zion National Park, Utah',
  difficulty: 'hard',
  length: '5.4 miles',
  elevation: '1,488 ft',
  description: 'Famous chain-assisted climb with panoramic views',
  highlights: ['Chain route', 'Panoramic views', 'Scenic overlooks'],
  permits: ['Permit required (lottery system)'],
  hazards: ['Exposure', 'Crowds', 'Heat'],
  bestSeasons: ['Spring', 'Fall'],
};

export function OfflineAIScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <OfflineAIChat trail={DEMO_TRAIL} showModelInfo={true} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
});

export default OfflineAIScreen;
