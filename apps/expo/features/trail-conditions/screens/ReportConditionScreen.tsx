import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCreateTrailCondition } from '../hooks/useTrailConditions';

const SURFACE_OPTIONS = [
  { value: 'paved', label: '🛣️ Paved' },
  { value: 'gravel', label: '🪨 Gravel' },
  { value: 'dirt', label: '🌲 Dirt' },
  { value: 'rocky', label: '⛰️ Rocky' },
  { value: 'snow', label: '❄️ Snow' },
  { value: 'mud', label: '💧 Mud' },
];

const DIFFICULTY_OPTIONS = [1, 2, 3, 4, 5];

export function ReportConditionScreen() {
  const router = useRouter();
  const { mutate: submitReport, isPending } = useCreateTrailCondition();

  const [trailName, setTrailName] = useState('');
  const [surfaceCondition, setSurfaceCondition] = useState('');
  const [difficulty, setDifficulty] = useState(0);
  const [hasFallenTrees, setHasFallenTrees] = useState(false);
  const [hasWildlife, setHasWildlife] = useState(false);
  const [hasErosion, setHasErosion] = useState(false);
  const [hasClosures, setHasClosures] = useState(false);
  const [hasWaterCrossings, setHasWaterCrossings] = useState(false);
  const [waterCrossingCount, setWaterCrossingCount] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!trailName.trim()) {
      Alert.alert('Error', 'Please enter a trail name');
      return;
    }

    submitReport({
      trailName: trailName.trim(),
      surfaceCondition: surfaceCondition || undefined,
      difficulty: difficulty || undefined,
      hasFallenTrees,
      hasWildlife,
      hasErosion,
      hasClosures,
      hasWaterCrossings,
      waterCrossingCount: waterCrossingCount ? parseInt(waterCrossingCount) : undefined,
      notes: notes || undefined,
    }, {
      onSuccess: () => {
        Alert.alert('Success', 'Trail condition reported!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      },
      onError: (error) => {
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to submit report');
      },
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🥾 Report Trail Conditions</Text>
        <Text style={styles.subtitle}>Help other hikers by sharing current conditions</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>Trail Name *</Text>
          <TextInput
            style={styles.input}
            value={trailName}
            onChangeText={setTrailName}
            placeholder="Enter trail name"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Surface Condition</Text>
          <View style={styles.optionsRow}>
            {SURFACE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  surfaceCondition === option.value && styles.optionButtonActive
                ]}
                onPress={() => setSurfaceCondition(option.value)}
              >
                <Text style={[
                  styles.optionText,
                  surfaceCondition === option.value && styles.optionTextActive
                ]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Difficulty</Text>
          <View style={styles.optionsRow}>
            {DIFFICULTY_OPTIONS.map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.difficultyButton,
                  difficulty === level && styles.difficultyButtonActive
                ]}
                onPress={() => setDifficulty(level)}
              >
                <Text style={[
                  styles.difficultyText,
                  difficulty === level && styles.difficultyTextActive
                ]}>{'⭐'.repeat(level)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Hazards</Text>
          
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>🌲 Fallen Trees</Text>
            <Switch value={hasFallenTrees} onValueChange={setHasFallenTrees} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>🦌 Wildlife</Text>
            <Switch value={hasWildlife} onValueChange={setHasWildlife} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>🏔️ Erosion</Text>
            <Switch value={hasErosion} onValueChange={setHasErosion} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>⛔ Closures</Text>
            <Switch value={hasClosures} onValueChange={setHasClosures} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>💧 Water Crossings</Text>
            <Switch value={hasWaterCrossings} onValueChange={setHasWaterCrossings} />
          </View>
        </View>

        {hasWaterCrossings && (
          <View style={styles.field}>
            <Text style={styles.label}>Number of Water Crossings</Text>
            <TextInput
              style={styles.input}
              value={waterCrossingCount}
              onChangeText={setWaterCrossingCount}
              placeholder="e.g., 3"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
            />
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Additional Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any other details about trail conditions..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isPending && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isPending}
        >
          {isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Report</Text>
          )}
        </TouchableOpacity>
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
  form: {
    padding: 16,
    gap: 20,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    height: 100,
    paddingTop: 16,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionButtonActive: {
    backgroundColor: '#f97316',
    borderColor: '#f97316',
  },
  optionText: {
    fontSize: 14,
    color: '#374151',
  },
  optionTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  difficultyButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  difficultyButtonActive: {
    backgroundColor: '#fbbf24',
    borderColor: '#fbbf24',
  },
  difficultyText: {
    fontSize: 14,
  },
  difficultyTextActive: {
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  switchLabel: {
    fontSize: 16,
    color: '#374151',
  },
  submitButton: {
    backgroundColor: '#f97316',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
