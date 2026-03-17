import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { nanoid } from 'nanoid/non-secure';
import { WILDLIFE_HISTORY_QUERY_KEY, WILDLIFE_HISTORY_STORAGE_KEY } from '../constants';
import type { IdentificationResult, SpeciesCategory, SpeciesIdentification } from '../types';

const MOCK_SPECIES_DATABASE: Record<
  string,
  Omit<SpeciesIdentification, 'id' | 'imageUri' | 'identifiedAt' | 'confidence'>
> = {
  oak_tree: {
    name: 'Northern Red Oak',
    scientificName: 'Quercus rubra',
    description:
      'A large deciduous tree with lobed leaves and distinctive acorns. Common in eastern North American forests.',
    category: 'tree' as SpeciesCategory,
    habitat: 'Deciduous forests, hillsides',
    edibility: 'unknown',
    region: 'Eastern North America',
    conservationStatus: 'Least Concern',
    funFact: 'Red oak acorns take two years to mature, unlike white oaks which mature in one year.',
  },
  wild_blueberry: {
    name: 'Wild Blueberry',
    scientificName: 'Vaccinium angustifolium',
    description:
      'A low-growing shrub with small oval leaves and blue-black berries. Found in acidic soils.',
    category: 'plant' as SpeciesCategory,
    habitat: 'Acidic soils, open woodlands, rocky terrain',
    edibility: 'edible',
    region: 'Northern North America',
    conservationStatus: 'Least Concern',
    funFact: 'Wild blueberries have twice the antioxidants of cultivated blueberries.',
  },
  black_bear: {
    name: 'American Black Bear',
    scientificName: 'Ursus americanus',
    description:
      "North America's most common bear species. Despite the name, coat color varies from black to brown and cinnamon.",
    category: 'animal' as SpeciesCategory,
    habitat: 'Forests, mountains, swamps',
    edibility: 'unknown',
    region: 'North America',
    conservationStatus: 'Least Concern',
    funFact: 'Black bears are excellent climbers and can run up to 35 mph over short distances.',
  },
  bald_eagle: {
    name: 'Bald Eagle',
    scientificName: 'Haliaeetus leucocephalus',
    description:
      'The national bird of the United States. Recognized by its distinctive white head and tail feathers.',
    category: 'bird' as SpeciesCategory,
    habitat: 'Near large bodies of water, forests',
    edibility: 'unknown',
    region: 'North America',
    conservationStatus: 'Least Concern',
    funFact:
      'Bald eagles were removed from the endangered species list in 2007 after a successful recovery program.',
  },
  chanterelle: {
    name: 'Golden Chanterelle',
    scientificName: 'Cantharellus cibarius',
    description:
      'A golden-yellow mushroom with a distinctive fruity smell and forked ridges instead of true gills.',
    category: 'mushroom' as SpeciesCategory,
    habitat: 'Mossy forests, near conifers and hardwoods',
    edibility: 'edible',
    region: 'North America, Europe',
    conservationStatus: 'Least Concern',
    funFact: 'Chanterelles are one of the most prized edible wild mushrooms in the world.',
  },
  monarch_butterfly: {
    name: 'Monarch Butterfly',
    scientificName: 'Danaus plexippus',
    description:
      'Famous for its spectacular annual migration of up to 3,000 miles. Recognized by orange and black wings.',
    category: 'insect' as SpeciesCategory,
    habitat: 'Open meadows, fields, roadsides near milkweed',
    edibility: 'unknown',
    region: 'North America',
    conservationStatus: 'Endangered',
    funFact:
      "Monarchs use the sun as a compass and the Earth's magnetic field to navigate during migration.",
  },
  fiddlehead_fern: {
    name: 'Ostrich Fern',
    scientificName: 'Matteuccia struthiopteris',
    description:
      'Known for its edible fiddleheads (coiled young fronds) harvested in spring. Forms large vase-shaped clumps.',
    category: 'plant' as SpeciesCategory,
    habitat: 'Moist riverbanks, floodplains, shaded forests',
    edibility: 'edible',
    region: 'North America, Asia, Europe',
    conservationStatus: 'Least Concern',
    funFact: 'Fiddleheads must be cooked before eating to neutralize harmful compounds.',
  },
  poison_ivy: {
    name: 'Poison Ivy',
    scientificName: 'Toxicodendron radicans',
    description:
      'Recognized by its three-leaflet clusters. All parts contain urushiol, which causes allergic contact dermatitis.',
    category: 'plant' as SpeciesCategory,
    habitat: 'Forest edges, roadsides, disturbed areas',
    edibility: 'poisonous',
    region: 'North America, Asia',
    conservationStatus: 'Least Concern',
    funFact:
      'Leaves of three, let it be. The plant produces berries that many birds can eat without harm.',
  },
};

const SPECIES_KEYS = Object.keys(MOCK_SPECIES_DATABASE);

// TODO: Replace with real ExecuTorch/TFLite model call before production release.
// Swap the body of this function; the return type contract must be preserved.
async function runOnDeviceInference(imageUri: string): Promise<IdentificationResult> {
  const startTime = Date.now();

  await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 700));

  const numResults = Math.floor(Math.random() * 2) + 1;
  const shuffled = [...SPECIES_KEYS].sort(() => Math.random() - 0.5);
  const selectedKeys = shuffled.slice(0, numResults);

  const topConfidence = 0.72 + Math.random() * 0.25;
  const species: SpeciesIdentification[] = selectedKeys.map((key, index) => {
    const base = MOCK_SPECIES_DATABASE[key];
    const confidence = index === 0 ? topConfidence : topConfidence * (0.3 + Math.random() * 0.4);
    return {
      ...base,
      id: nanoid(),
      imageUri,
      identifiedAt: new Date().toISOString(),
      confidence: Math.min(confidence, 0.99),
    };
  });

  species.sort((a, b) => b.confidence - a.confidence);

  return {
    species,
    isOffline: true,
    processingTimeMs: Date.now() - startTime,
  };
}

export async function persistIdentificationToHistory(
  identification: SpeciesIdentification,
): Promise<void> {
  const stored = await AsyncStorage.getItem(WILDLIFE_HISTORY_STORAGE_KEY);
  let existing: SpeciesIdentification[] = [];
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      existing = Array.isArray(parsed) ? parsed : [];
    } catch {
      await AsyncStorage.removeItem(WILDLIFE_HISTORY_STORAGE_KEY);
    }
  }
  const updated = [identification, ...existing].slice(0, 100);
  await AsyncStorage.setItem(WILDLIFE_HISTORY_STORAGE_KEY, JSON.stringify(updated));
}

export function useWildlifeIdentification() {
  const queryClient = useQueryClient();

  const captureAndIdentifyMutation = useMutation({
    mutationFn: async (source: 'camera' | 'library') => {
      let imageUri: string | null = null;

      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          throw new Error('Camera permission is required to identify species.');
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsEditing: true,
          aspect: [4, 3],
        });
        if (result.canceled) return null;
        imageUri = result.assets[0]?.uri ?? null;
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          throw new Error('Photo library permission is required.');
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          allowsEditing: true,
          aspect: [4, 3],
        });
        if (result.canceled) return null;
        imageUri = result.assets[0]?.uri ?? null;
      }

      if (!imageUri) return null;

      const identificationResult = await runOnDeviceInference(imageUri);

      if (identificationResult.species.length > 0 && identificationResult.species[0]) {
        await persistIdentificationToHistory(identificationResult.species[0]);
        await queryClient.invalidateQueries({ queryKey: WILDLIFE_HISTORY_QUERY_KEY });
      }

      return identificationResult;
    },
  });

  return {
    identify: captureAndIdentifyMutation.mutate,
    result: captureAndIdentifyMutation.data,
    isPending: captureAndIdentifyMutation.isPending,
    isError: captureAndIdentifyMutation.isError,
    error: captureAndIdentifyMutation.error,
    reset: captureAndIdentifyMutation.reset,
  };
}
