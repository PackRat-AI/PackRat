/**
 * On-Device AI Configuration
 * Centralized configuration for on-device AI models and settings
 */

/**
 * Default model configuration
 * These values are used across the on-device AI implementation
 */
export const DEFAULT_MODEL_CONFIG = {
  /**
   * Model identifier
   */
  id: 'qwen-2.5-600m',
  
  /**
   * Display name for the model
   */
  name: 'Qwen3-600m',
  
  /**
   * Approximate download size in MB
   */
  sizeMB: 600,
  
  /**
   * Model description
   */
  description: 'Compact on-device model optimized for mobile inference',
} as const;

/**
 * Performance expectations per device tier
 */
export const PERFORMANCE_TIERS = {
  midRange: {
    tokensPerSecond: 20,
    description: 'Mid-range Android devices',
  },
  highEnd: {
    tokensPerSecond: 50,
    description: 'iPhone 14 Pro and equivalent',
  },
  flagship: {
    tokensPerSecond: 75,
    description: 'Latest flagship devices',
  },
} as const;

/**
 * Memory requirements
 */
export const MEMORY_REQUIREMENTS = {
  /**
   * Storage space needed for model download
   */
  storageMB: DEFAULT_MODEL_CONFIG.sizeMB,
  
  /**
   * RAM usage during inference
   */
  ramMB: 1000,
} as const;
