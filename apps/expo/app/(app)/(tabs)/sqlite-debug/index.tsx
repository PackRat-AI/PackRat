import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function SQLiteKVDebug() {
  const [isLoading, setIsLoading] = useState(true);
  const [entries, setEntries] = useState<Array<{ key: string; value: any }>>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editMode, setEditMode] = useState<{ key: string; value: string } | null>(null);

  // Load all entries from the KV store
  const loadEntries = async () => {
    setIsLoading(true);
    try {
      const allKeys = await Storage.getAllKeys();
      const loadedEntries = await Promise.all(
        allKeys.map(async (key) => {
          const value = await Storage.getItem(key);
          return { key, value };
        })
      );
      setEntries(loadedEntries);
    } catch (error) {
      console.error('Error loading entries:', error);
      Alert.alert('Error', 'Failed to load entries from storage');
    } finally {
      setIsLoading(false);
    }
  };

  // Add a new entry to the KV store
  const addEntry = async () => {
    if (!newKey.trim()) {
      Alert.alert('Error', 'Key cannot be empty');
      return;
    }

    try {
      let parsedValue;
      try {
        // Try to parse as JSON if it looks like an object or array
        if (
          (newValue.startsWith('{') && newValue.endsWith('}')) ||
          (newValue.startsWith('[') && newValue.endsWith(']'))
        ) {
          parsedValue = JSON.parse(newValue);
        } else {
          parsedValue = newValue;
        }
      } catch (_e) {
        parsedValue = newValue;
      }

      await Storage.setItem(newKey, parsedValue);
      setNewKey('');
      setNewValue('');
      loadEntries();
    } catch (error) {
      console.error('Error adding entry:', error);
      Alert.alert('Error', 'Failed to add entry to storage');
    }
  };

  // Update an existing entry
  const updateEntry = async () => {
    if (!editMode) return;

    try {
      let parsedValue;
      try {
        // Try to parse as JSON if it looks like an object or array
        if (
          (editMode.value.startsWith('{') && editMode.value.endsWith('}')) ||
          (editMode.value.startsWith('[') && editMode.value.endsWith(']'))
        ) {
          parsedValue = JSON.parse(editMode.value);
        } else {
          parsedValue = editMode.value;
        }
      } catch (_e) {
        parsedValue = editMode.value;
      }

      await Storage.setItem(editMode.key, parsedValue);
      setEditMode(null);
      loadEntries();
    } catch (error) {
      console.error('Error updating entry:', error);
      Alert.alert('Error', 'Failed to update entry in storage');
    }
  };

  // Delete an entry from the KV store
  const deleteEntry = async (key: string) => {
    try {
      await Storage.removeItem(key); // Changed from deleteItem to removeItem
      loadEntries();
    } catch (error) {
      console.error('Error deleting entry:', error);
      Alert.alert('Error', 'Failed to delete entry from storage');
    }
  };

  // Clear all entries from the KV store
  const clearAllEntries = async () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to delete all entries? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              const allKeys = await Storage.getAllKeys();
              await Promise.all(allKeys.map((key) => Storage.removeItem(key))); // Changed from deleteItem to removeItem
              loadEntries();
            } catch (error) {
              console.error('Error clearing entries:', error);
              Alert.alert('Error', 'Failed to clear all entries from storage');
            }
          },
        },
      ]
    );
  };

  // Format value for display
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return String(value);
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  // Load entries on component mount
  useEffect(() => {
    loadEntries();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SQLite KV-Store Debug</Text>

      {/* Add new entry section */}
      <View style={styles.addSection}>
        <Text style={styles.sectionTitle}>Add New Entry</Text>
        <TextInput style={styles.input} placeholder="Key" value={newKey} onChangeText={setNewKey} />
        <TextInput
          style={[styles.input, styles.valueInput]}
          placeholder="Value (string or JSON)"
          value={newValue}
          onChangeText={setNewValue}
          multiline
        />
        <Button title="Add Entry" onPress={addEntry} />
      </View>

      {/* Edit modal */}
      {editMode && (
        <View style={styles.editSection}>
          <Text style={styles.sectionTitle}>Edit Entry: {editMode.key}</Text>
          <TextInput
            style={[styles.input, styles.valueInput]}
            value={editMode.value}
            onChangeText={(text) => setEditMode({ ...editMode, value: text })}
            multiline
          />
          <View style={styles.buttonRow}>
            <Button title="Cancel" onPress={() => setEditMode(null)} color="#999" />
            <Button title="Save" onPress={updateEntry} />
          </View>
        </View>
      )}

      {/* Entries list */}
      <View style={styles.entriesSection}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Stored Entries</Text>
          <Button title="Refresh" onPress={loadEntries} />
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color="#0000ff" />
        ) : entries.length === 0 ? (
          <Text style={styles.emptyText}>No entries found</Text>
        ) : (
          <ScrollView style={styles.entriesList}>
            {entries.map((entry) => (
              <View key={entry.key} style={styles.entryCard}>
                <Text style={styles.entryKey}>{entry.key}</Text>
                <Text style={styles.entryValue}>{formatValue(entry.value)}</Text>
                <View style={styles.buttonRow}>
                  <Button
                    title="Edit"
                    onPress={() => setEditMode({ key: entry.key, value: formatValue(entry.value) })}
                  />
                  <Button title="Delete" onPress={() => deleteEntry(entry.key)} color="#ff0000" />
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Clear all button */}
      <View style={styles.clearSection}>
        <Button title="Clear All Data" onPress={clearAllEntries} color="#ff0000" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  addSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  editSection: {
    backgroundColor: '#fffde7',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  entriesSection: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entriesList: {
    flex: 1,
  },
  entryCard: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  entryKey: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  entryValue: {
    fontFamily: 'monospace',
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
  },
  valueInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
    fontStyle: 'italic',
  },
  clearSection: {
    marginTop: 8,
  },
});
