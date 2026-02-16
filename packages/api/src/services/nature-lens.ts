/**
 * NatureLens Service - On-Device Plant & Wildlife Identification
 * PackRat Feature - Powered by React Native AI
 * 
 * Uses React Native AI's image understanding for on-device identification
 * of plants, wildlife, tracks, and scat found on trails.
 */

import type { KnowledgeBaseEntry } from '../types';
import { LocalKnowledgeBase } from './knowledge-base.js';

// Type definitions for React Native AI modules (optional - used only when available)
type ImageUnderstandingType = {
  analyze: (imageData: Buffer | Uint8Array) => Promise<Array<{ text?: string; identifier?: string; confidence?: number }>>;
  release: () => Promise<void>;
};

type MLKitLabelerType = {
  analyze: (imageData: Buffer | Uint8Array) => Promise<Array<{ label?: string; text?: string; confidence?: number }>>;
  release: () => Promise<void>;
};

/**
 * NatureLens Service Configuration
 */
export interface NatureLensConfig {
  /** Knowledge base path */
  dataPath: string;
  
  /** Enable offline mode */
  offlineEnabled: boolean;
  
  /** Enable Apple Vision framework */
  appleVisionEnabled: boolean;
  
  /** Enable ML Kit for extended labels */
  mlKitEnabled: boolean;
  
  /** Minimum confidence for identification */
  minConfidence: number;
  
  /** Maximum results per analysis */
  maxResults: number;
}

/**
 * Default configuration
 */
const defaultConfig: NatureLensConfig = {
  dataPath: './data',
  offlineEnabled: true,
  appleVisionEnabled: true,
  mlKitEnabled: true,
  minConfidence: 0.6,
  maxResults: 5,
};

/**
 * Plant safety database - quick reference for common plants
 */
const plantSafetyDatabase: Record<string, SafetyLevel> = {
  'poison ivy': 'toxic',
  'poison oak': 'toxic',
  'poison sumac': 'toxic',
  'deadly nightshade': 'toxic',
  'belladonna': 'toxic',
  'hemlock': 'toxic',
  'oleander': 'toxic',
  'foxglove': 'toxic',
  'rhododendron': 'caution',
  'azalea': 'caution',
  'lily of the valley': 'caution',
  'castor bean': 'dangerous',
  'manchineel': 'toxic',
};

/**
 * Wildlife danger database
 */
const wildlifeDangerDatabase: Record<string, SafetyLevel> = {
  'bear': 'caution',
  'black bear': 'caution',
  'grizzly bear': 'dangerous',
  'brown bear': 'dangerous',
  'mountain lion': 'caution',
  'cougar': 'caution',
  'moose': 'caution',
  'elk': 'caution',
  'deer': 'safe',
  'rabbit': 'safe',
  'squirrel': 'safe',
  'rattlesnake': 'dangerous',
  'copperhead': 'dangerous',
  'cottonmouth': 'dangerous',
  'timber rattlesnake': 'dangerous',
};

/**
 * NatureLens - On-device plant and wildlife identification service
 */
export class NatureLensService {
  private config: NatureLensConfig;
  private knowledgeBase: LocalKnowledgeBase | null = null;
  private appleVision: ImageUnderstandingType | null = null;
  private mlKitLabeler: MLKitLabelerType | null = null;
  private initialized = false;

  constructor(config: Partial<NatureLensConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Initialize the NatureLens service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[NatureLens] Initializing service...');

    // Initialize knowledge base
    this.knowledgeBase = new LocalKnowledgeBase(this.config.dataPath);
    await this.knowledgeBase.initialize();
    console.log('[NatureLens] Knowledge base loaded');

    // Initialize Apple Vision if enabled
    if (this.config.appleVisionEnabled) {
      try {
        const appleModule = await import('@react-native-ai/apple');
        this.appleVision = new appleModule.ImageUnderstanding({
          confidenceThreshold: this.config.minConfidence,
          maximumLabels: this.config.maxResults,
        });
        console.log('[NatureLens] Apple Vision initialized');
      } catch (error) {
        console.warn('[NatureLens] Apple Vision not available:', error);
      }
    }

    // Initialize ML Kit if enabled
    if (this.config.mlKitEnabled) {
      try {
        const mlKitModule = await import('@react-native-ai/mlc');
        this.mlKitLabeler = new mlKitModule.MLKitImageLabeler({
          confidenceThreshold: this.config.minConfidence,
          maximumLabels: this.config.maxResults,
        });
        console.log('[NatureLens] ML Kit initialized');
      } catch (error) {
        console.warn('[NatureLens] ML Kit not available:', error);
      }
    }

    this.initialized = true;
    console.log('[NatureLens] Service ready');
  }

  /**
   * Identify plants, wildlife, or other nature items in an image
   */
  async identify(
    imageData: Buffer | Uint8Array,
    options: AnalysisOptions = {}
  ): Promise<IdentificationResult[]> {
    if (!this.initialized) {
      throw new Error('NatureLens service not initialized');
    }

    const {
      categories = ['plant', 'wildlife', 'track', 'scat', 'flower', 'mushroom'],
      includeDetails = true,
      maxResults = this.config.maxResults,
      minConfidence = this.config.minConfidence,
    } = options;

    const results: IdentificationResult[] = [];
    const startTime = Date.now();

    // Run analysis using available ML frameworks
    const analysisResults = await this.analyzeImage(imageData);

    // Process and filter results
    for (const result of analysisResults) {
      if (result.confidence < minConfidence) continue;
      if (categories.length > 0 && !categories.includes(result.category)) continue;

      const identification = await this.processIdentification(
        result,
        includeDetails
      );
      
      if (identification) {
        results.push(identification);
      }

      if (results.length >= maxResults) break;
    }

    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence);

    const processingTimeMs = Date.now() - startTime;
    console.log(`[NatureLens] Identified ${results.length} items in ${processingTimeMs}ms`);

    return results;
  }

  /**
   * Analyze image using available ML frameworks
   */
  private async analyzeImage(
    imageData: Buffer | Uint8Array
  ): Promise<Array<{ name: string; confidence: number; category: NatureCategory }>> {
    const results: Array<{ name: string; confidence: number; category: NatureCategory }> = [];

    // Use Apple Vision if available
    if (this.appleVision) {
      try {
        const visionResults = await this.appleVision.analyze(imageData);
        for (const label of visionResults) {
          results.push({
            name: this.normalizeLabelName(label.text || label.identifier || ''),
            confidence: label.confidence || 0.5,
            category: this.categorizeLabel(label.text || label.identifier || ''),
          });
        }
      } catch (error) {
        console.warn('[NatureLens] Apple Vision analysis failed:', error);
      }
    }

    // Use ML Kit if available
    if (this.mlKitLabeler) {
      try {
        const mlKitResults = await this.mlKitLabeler.analyze(imageData);
        for (const label of mlKitResults) {
          // Avoid duplicates
          const normalizedName = this.normalizeLabelName(label.text || label.label || '');
          if (!results.find(r => r.name.toLowerCase() === normalizedName.toLowerCase())) {
            results.push({
              name: normalizedName,
              confidence: label.confidence || 0.5,
              category: this.categorizeLabel(label.text || label.label || ''),
            });
          }
        }
      } catch (error) {
        console.warn('[NatureLens] ML Kit analysis failed:', error);
      }
    }

    // Fallback: simulate basic identification for testing
    if (results.length === 0) {
      results.push({
        name: 'unknown plant',
        confidence: 0.5,
        category: 'plant',
      });
    }

    return results;
  }

  /**
   * Process an identification result
   */
  private async processIdentification(
    analysis: { name: string; confidence: number; category: NatureCategory },
    includeDetails: boolean
  ): Promise<IdentificationResult | null> {
    const normalizedName = analysis.name.toLowerCase();

    // Determine safety level
    const safety = this.determineSafety(analysis.category, normalizedName);

    // Get knowledge base details
    let details: KnowledgeBaseEntry | undefined;
    if (includeDetails && this.knowledgeBase) {
      const kbResults = await this.knowledgeBase.query(
        analysis.name,
        analysis.category === 'plant' ? 'plant' : 
        analysis.category === 'wildlife' ? 'wildlife' : undefined,
        1
      );
      details = kbResults[0];
    }

    // Determine if edible
    const edible = this.determineEdibility(analysis.category, normalizedName);

    return {
      commonName: this.toTitleCase(analysis.name),
      scientificName: this.getScientificName(analysis.name),
      category: analysis.category,
      confidence: analysis.confidence,
      safety,
      edible,
      details,
      offlineAvailable: true,
    };
  }

  /**
   * Determine safety level for an identified item
   */
  private determineSafety(
    category: NatureCategory,
    name: string
  ): IdentificationResult['safety'] {
    // Check specific databases first
    if (plantSafetyDatabase[name]) {
      return {
        level: plantSafetyDatabase[name] as SafetyLevel,
        warnings: [this.getWarningForPlant(name)],
        precautions: [this.getPrecautionForPlant(name)],
      };
    }

    if (wildlifeDangerDatabase[name]) {
      return {
        level: wildlifeDangerDatabase[name] as SafetyLevel,
        warnings: [this.getWarningForWildlife(name)],
        precautions: [this.getPrecautionForWildlife(name)],
      };
    }

    // Default assessments by category
    switch (category) {
      case 'plant':
        return {
          level: 'caution',
          warnings: ['Always verify identification before touching or consuming'],
          precautions: ['Use a field guide for verification', 'Avoid handling unknown plants'],
        };
      case 'wildlife':
        return {
          level: 'caution',
          warnings: ['Wild animals may be unpredictable'],
          precautions: ['Observe from a safe distance', 'Do not approach or feed wildlife'],
        };
      case 'track':
      case 'scat':
        return {
          level: 'safe',
          warnings: [],
          precautions: ['Wash hands after handling wildlife signs'],
        };
      case 'mushroom':
        return {
          level: 'dangerous',
          warnings: ['Mushroom identification requires expert-level skills'],
          precautions: ['Never consume wild mushrooms without expert identification'],
        };
      case 'flower':
        return {
          level: 'safe',
          warnings: [],
          precautions: ['Some flowers may cause skin irritation'],
        };
      default:
        return {
          level: 'caution',
          warnings: [],
          precautions: ['Use caution when handling unknown nature items'],
        };
    }
  }

  /**
   * Determine if an item is edible
   */
  private determineEdibility(
    category: NatureCategory,
    name: string
  ): boolean | undefined {
    const ediblePlants = [
      'huckleberry',
      'thimbleberry',
      'saskatoon berry',
      'serviceberry',
      'wild strawberry',
      'blackberry',
      'raspberry',
      'blueberry',
      'clover',
      'dandelion',
      'pine needle',
      'cattail',
      'acorn',
    ];

    const poisonousPlants = [
      'poison ivy',
      'poison oak',
      'poison sumac',
      'deadly nightshade',
      'belladonna',
      'hemlock',
      'oleander',
      'foxglove',
    ];

    if (category === 'plant') {
      if (poisonousPlants.some(p => name.includes(p))) return false;
      if (ediblePlants.some(p => name.includes(p))) return true;
    }

    return undefined; // Unknown
  }

  /**
   * Normalize label names from ML frameworks
   */
  private normalizeLabelName(name: string): string {
    return name
      .toLowerCase()
      .replace(/^an\s+/, '') // Remove "an " prefix
      .replace(/[0-9]+%/g, '') // Remove confidence percentages
      .replace(/\([^)]*\)/g, '') // Remove parentheticals
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Categorize a label into nature categories
   */
  private categorizeLabel(label: string): NatureCategory {
    const normalizedLabel = label.toLowerCase();

    const plantPatterns = [
      /poison\s*(ivy|oak|sumac)/i,
      /leaf|plant|flower|tree|grass|moss|fern/i,
    ];

    const wildlifePatterns = [
      /bear|deer|moose|elk|wolf|coyote|fox|rabbit|squirrel|raccoon/i,
      /bird|eagle|hawk|owl|raven|finch|sparrow/i,
      /snake|lizard|frog|toad|turtle|tortoise/i,
    ];

    const trackPatterns = [
      /track|paw print|footprint|hoof print/i,
    ];

    const scatPatterns = [
      /scat|droppings|manure|feces|poop/i,
    ];

    const flowerPatterns = [
      /flower|blossom|petal|bloom/i,
    ];

    const mushroomPatterns = [
      /mushroom|fungus|toadstool/i,
    ];

    if (mushroomPatterns.some(p => p.test(normalizedLabel))) return 'mushroom';
    if (trackPatterns.some(p => p.test(normalizedLabel))) return 'track';
    if (scatPatterns.some(p => p.test(normalizedLabel))) return 'scat';
    if (flowerPatterns.some(p => p.test(normalizedLabel))) return 'flower';
    if (plantPatterns.some(p => p.test(normalizedLabel))) return 'plant';
    if (wildlifePatterns.some(p => p.test(normalizedLabel))) return 'wildlife';

    return 'plant'; // Default to plant
  }

  /**
   * Get warning message for toxic plants
   */
  private getWarningForPlant(name: string): string {
    const warnings: Record<string, string> = {
      'poison ivy': 'Contains urushiol oil - causes severe skin rash and irritation',
      'poison oak': 'Contains urushiol oil - causes skin rash and irritation',
      'poison sumac': 'Contains urushiol oil - causes severe skin rash',
      'deadly nightshade': 'Extremely toxic - all parts are poisonous',
      'belladonna': 'Extremely toxic - contains atropine and scopolamine',
      'hemlock': 'Deadly poisonous - contains coniine toxin',
      'oleander': 'Toxic if ingested - affects heart rhythm',
      'foxglove': 'Toxic - contains digitalis compounds',
    };

    return warnings[name.toLowerCase()] || 'Toxic - avoid contact and ingestion';
  }

  /**
   * Get precaution message for toxic plants
   */
  private getPrecautionForPlant(name: string): string {
    const precautions: Record<string, string> = {
      'poison ivy': 'Learn to identify "leaves of three". Wear long pants. Wash skin thoroughly if exposed.',
      'poison oak': 'Learn to identify leaves. Wear protective clothing. Use Tecnu or similar cleanser.',
      'poison sumac': 'Learn to identify. Avoid contact with any unfamiliar sumac species.',
      'deadly nightshade': 'Keep children and pets away. Do not consume any berries.',
      'belladonna': 'Extremely dangerous. Do not touch or consume any parts.',
      'hemlock': 'Deadly poison. Do not touch or consume.',
      'oleander': 'All parts toxic. Do not use for firewood or cooking implements.',
      'foxglove': 'Toxic if ingested. Keep away from children and pets.',
    };

    return precautions[name.toLowerCase()] || 'Do not touch or consume';
  }

  /**
   * Get warning message for wildlife
   */
  private getWarningForWildlife(name: string): string {
    const warnings: Record<string, string> = {
      'bear': 'Can be dangerous if threatened or with cubs. Make noise while hiking.',
      'black bear': 'Generally shy but can be aggressive near food. Store food properly.',
      'grizzly bear': 'Highly dangerous. Carry bear spray. Make yourself known.',
      'mountain lion': 'Rarely attacks humans but can be territorial. Do not run.',
      'cougar': 'May attack if feels threatened. Face the animal and maintain eye contact.',
      'moose': 'Most dangerous large animal. Can charge without warning, especially in fall.',
      'rattlesnake': 'Venomous. Watch step placement. Give wide berth.',
    };

    return warnings[name.toLowerCase()] || 'Observe from a safe distance';
  }

  /**
   * Get precaution message for wildlife
   */
  private getPrecautionForWildlife(name: string): string {
    const precautions: Record<string, string> = {
      'bear': 'Store food in bear-resistant containers. Cook away from sleeping area.',
      'black bear': 'Make noise while hiking. Never approach cubs.',
      'grizzly bear': 'Travel in groups. Carry bear spray in accessible location.',
      'mountain lion': 'Do not hike alone. Keep children in sight. If attacked, fight back.',
      'moose': 'Give wide berth, especially during fall rut. Do not get between cow and calf.',
      'rattlesnake': 'Stay on trails. Watch where you place hands and feet.',
    };

    return precautions[name.toLowerCase()] || 'Maintain safe distance';
  }

  /**
   * Get scientific name (simplified lookup)
   */
  private getScientificName(commonName: string): string | undefined {
    const scientificNames: Record<string, string> = {
      'poison ivy': 'Toxicodendron radicans',
      'poison oak': 'Toxicodendron diversilobum',
      'poison sumac': 'Toxicodendron vernix',
      'black bear': 'Ursus americanus',
      'grizzly bear': 'Ursus arctos horribilis',
      'moose': 'Alces alces',
      'mountain lion': 'Puma concolor',
      'rattlesnake': 'Crotalus spp.',
    };

    return scientificNames[commonName.toLowerCase()];
  }

  /**
   * Convert string to title case
   */
  private toTitleCase(str: string): string {
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    appleVision: boolean;
    mlKit: boolean;
    knowledgeBase: boolean;
  } {
    return {
      initialized: this.initialized,
      appleVision: this.appleVision !== null,
      mlKit: this.mlKitLabeler !== null,
      knowledgeBase: this.knowledgeBase !== null,
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    console.log('[NatureLens] Shutting down service...');
    
    if (this.appleVision) {
      await this.appleVision.release();
      this.appleVision = null;
    }

    if (this.mlKitLabeler) {
      await this.mlKitLabeler.release();
      this.mlKitLabeler = null;
    }

    this.knowledgeBase = null;
    this.initialized = false;
    
    console.log('[NatureLens] Service shutdown complete');
  }
}

// Export types for external use
export type { NatureLensConfig, AnalysisOptions } from './nature-lens.js';

// Singleton instance
let natureLensInstance: NatureLensService | null = null;

/**
 * Get or create NatureLens service instance
 */
export function getNatureLensService(config?: Partial<NatureLensConfig>): NatureLensService {
  if (!natureLensInstance) {
    natureLensInstance = new NatureLensService(config);
  }
  return natureLensInstance;
}
