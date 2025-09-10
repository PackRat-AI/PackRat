import type { PackCategory } from '../types';

export interface EssentialItem {
  name: string;
  category: string;
  priority: 'essential' | 'recommended' | 'optional';
  description?: string;
  alternatives?: string[];
}

export interface GearGapAnalysis {
  activityType: PackCategory;
  missingItems: EssentialItem[];
  missingByCategory: Record<string, EssentialItem[]>;
  completionPercentage: number;
  summary: {
    essentialMissing: number;
    recommendedMissing: number;
    optionalMissing: number;
  };
}

// Essential items configuration for different activity types
const ESSENTIAL_ITEMS_BY_ACTIVITY: Record<PackCategory, EssentialItem[]> = {
  hiking: [
    {
      name: 'Water Bottle',
      category: 'Hydration',
      priority: 'essential',
      description: 'Minimum 1-2 liters for day hikes',
    },
    {
      name: 'Map and Compass',
      category: 'Navigation',
      priority: 'essential',
      alternatives: ['GPS Device', 'Smartphone with GPS'],
    },
    {
      name: 'First Aid Kit',
      category: 'Safety',
      priority: 'essential',
      description: 'Basic first aid supplies',
    },
    { name: 'Headlamp', category: 'Lighting', priority: 'essential', alternatives: ['Flashlight'] },
    {
      name: 'Rain Jacket',
      category: 'Clothing',
      priority: 'recommended',
      description: 'Weather protection',
    },
    {
      name: 'Snacks',
      category: 'Food',
      priority: 'essential',
      description: 'High-energy trail snacks',
    },
    {
      name: 'Hiking Boots',
      category: 'Footwear',
      priority: 'essential',
      alternatives: ['Trail Runners'],
    },
    {
      name: 'Backpack',
      category: 'Gear',
      priority: 'essential',
      description: 'Appropriate size for day hiking',
    },
    {
      name: 'Sun Protection',
      category: 'Safety',
      priority: 'recommended',
      alternatives: ['Sunglasses', 'Hat', 'Sunscreen'],
    },
    {
      name: 'Emergency Whistle',
      category: 'Safety',
      priority: 'recommended',
      description: 'For emergency signaling',
    },
  ],
  backpacking: [
    // Essential items for multi-day hiking
    {
      name: 'Backpack',
      category: 'Gear',
      priority: 'essential',
      description: '40-70L capacity for multi-day trips',
    },
    { name: 'Tent', category: 'Shelter', priority: 'essential', alternatives: ['Bivy', 'Tarp'] },
    {
      name: 'Sleeping Bag',
      category: 'Sleep System',
      priority: 'essential',
      description: 'Rated for expected temperatures',
    },
    {
      name: 'Sleeping Pad',
      category: 'Sleep System',
      priority: 'essential',
      description: 'Insulation and comfort',
    },
    {
      name: 'Stove',
      category: 'Cooking',
      priority: 'essential',
      alternatives: ['Portable Gas Stove', 'Alcohol Stove'],
    },
    {
      name: 'Cookpot',
      category: 'Cooking',
      priority: 'essential',
      description: 'Lightweight camping cookware',
    },
    {
      name: 'Water Filter',
      category: 'Hydration',
      priority: 'essential',
      alternatives: ['Water Purification Tablets'],
    },
    {
      name: 'Map and Compass',
      category: 'Navigation',
      priority: 'essential',
      alternatives: ['GPS Device'],
    },
    {
      name: 'First Aid Kit',
      category: 'Safety',
      priority: 'essential',
      description: 'Comprehensive wilderness first aid',
    },
    { name: 'Headlamp', category: 'Lighting', priority: 'essential', alternatives: ['Flashlight'] },
    {
      name: 'Food',
      category: 'Food',
      priority: 'essential',
      description: 'Enough for the entire trip plus 1 day',
    },
    {
      name: 'Rain Gear',
      category: 'Clothing',
      priority: 'essential',
      description: 'Jacket and pants',
    },
    {
      name: 'Warm Layer',
      category: 'Clothing',
      priority: 'essential',
      alternatives: ['Down Jacket', 'Fleece'],
    },
    { name: 'Multi-tool', category: 'Tools', priority: 'recommended', alternatives: ['Knife'] },
    {
      name: 'Rope/Paracord',
      category: 'Safety',
      priority: 'recommended',
      description: 'For emergency repairs',
    },
  ],
  camping: [
    { name: 'Tent', category: 'Shelter', priority: 'essential', alternatives: ['RV', 'Cabin'] },
    {
      name: 'Sleeping Bag',
      category: 'Sleep System',
      priority: 'essential',
      description: 'Appropriate temperature rating',
    },
    {
      name: 'Sleeping Pad',
      category: 'Sleep System',
      priority: 'recommended',
      description: 'For comfort and insulation',
    },
    {
      name: 'Camp Stove',
      category: 'Cooking',
      priority: 'recommended',
      alternatives: ['Campfire', 'Portable Grill'],
    },
    {
      name: 'Cooler',
      category: 'Food Storage',
      priority: 'recommended',
      description: 'For car camping',
    },
    {
      name: 'Lantern',
      category: 'Lighting',
      priority: 'essential',
      alternatives: ['Headlamp', 'Flashlight'],
    },
    {
      name: 'First Aid Kit',
      category: 'Safety',
      priority: 'essential',
      description: 'Basic medical supplies',
    },
    {
      name: 'Water Container',
      category: 'Hydration',
      priority: 'essential',
      description: 'Bottles or jugs',
    },
    {
      name: 'Camp Chairs',
      category: 'Comfort',
      priority: 'optional',
      description: 'For relaxation',
    },
    {
      name: 'Trash Bags',
      category: 'Leave No Trace',
      priority: 'essential',
      description: 'Pack out all trash',
    },
  ],
  climbing: [
    {
      name: 'Climbing Helmet',
      category: 'Safety',
      priority: 'essential',
      description: 'Head protection from rockfall',
    },
    {
      name: 'Climbing Harness',
      category: 'Safety',
      priority: 'essential',
      description: 'Full body harness for climbing',
    },
    {
      name: 'Climbing Rope',
      category: 'Safety',
      priority: 'essential',
      description: 'Dynamic climbing rope',
    },
    {
      name: 'Belay Device',
      category: 'Safety',
      priority: 'essential',
      description: 'For belaying and rappelling',
    },
    {
      name: 'Carabiners',
      category: 'Hardware',
      priority: 'essential',
      description: 'Locking and non-locking carabiners',
    },
    {
      name: 'Quickdraws',
      category: 'Hardware',
      priority: 'essential',
      description: 'For sport climbing',
    },
    {
      name: 'Climbing Shoes',
      category: 'Footwear',
      priority: 'essential',
      description: 'Specialized climbing footwear',
    },
    {
      name: 'Chalk and Chalk Bag',
      category: 'Accessories',
      priority: 'essential',
      description: 'Improve grip',
    },
    {
      name: 'Approach Shoes',
      category: 'Footwear',
      priority: 'recommended',
      description: 'For hiking to climbs',
    },
    {
      name: 'First Aid Kit',
      category: 'Safety',
      priority: 'essential',
      description: 'Wilderness first aid',
    },
    {
      name: 'Headlamp',
      category: 'Lighting',
      priority: 'essential',
      description: 'For early starts or late finishes',
    },
  ],
  winter: [
    {
      name: 'Insulated Jacket',
      category: 'Clothing',
      priority: 'essential',
      description: 'Down or synthetic insulation',
    },
    {
      name: 'Base Layers',
      category: 'Clothing',
      priority: 'essential',
      description: 'Moisture-wicking thermal layers',
    },
    {
      name: 'Winter Boots',
      category: 'Footwear',
      priority: 'essential',
      description: 'Insulated and waterproof',
    },
    { name: 'Warm Hat', category: 'Clothing', priority: 'essential', description: 'Covers ears' },
    {
      name: 'Insulated Gloves',
      category: 'Clothing',
      priority: 'essential',
      description: 'Waterproof winter gloves',
    },
    {
      name: 'Winter Sleeping Bag',
      category: 'Sleep System',
      priority: 'essential',
      description: 'Rated for winter temperatures',
    },
    {
      name: 'Insulated Sleeping Pad',
      category: 'Sleep System',
      priority: 'essential',
      description: 'High R-value for snow',
    },
    {
      name: 'Snow Shovel',
      category: 'Safety',
      priority: 'essential',
      description: 'For campsite preparation and avalanche safety',
    },
    {
      name: 'Avalanche Beacon',
      category: 'Safety',
      priority: 'essential',
      description: 'For avalanche terrain',
    },
    {
      name: 'Microspikes',
      category: 'Traction',
      priority: 'recommended',
      alternatives: ['Crampons', 'Snowshoes'],
    },
    {
      name: 'Emergency Shelter',
      category: 'Safety',
      priority: 'recommended',
      alternatives: ['Bivy', 'Emergency Tarp'],
    },
    {
      name: 'Hand Warmers',
      category: 'Comfort',
      priority: 'optional',
      description: 'Chemical heat packs',
    },
  ],
  desert: [
    {
      name: 'Extra Water',
      category: 'Hydration',
      priority: 'essential',
      description: 'Minimum 1 gallon per day',
    },
    {
      name: 'Sun Hat',
      category: 'Clothing',
      priority: 'essential',
      description: 'Wide brim for sun protection',
    },
    { name: 'Sunglasses', category: 'Safety', priority: 'essential', description: 'UV protection' },
    {
      name: 'Sunscreen',
      category: 'Safety',
      priority: 'essential',
      description: 'High SPF, reapply regularly',
    },
    {
      name: 'Long-sleeve Shirt',
      category: 'Clothing',
      priority: 'essential',
      description: 'UV protection and cooling',
    },
    {
      name: 'Electrolyte Supplements',
      category: 'Hydration',
      priority: 'recommended',
      description: 'Replace lost salts',
    },
    {
      name: 'Emergency Shade',
      category: 'Shelter',
      priority: 'recommended',
      alternatives: ['Tarp', 'Emergency Blanket'],
    },
    {
      name: 'GPS Device',
      category: 'Navigation',
      priority: 'essential',
      description: 'Desert navigation can be challenging',
    },
    {
      name: 'Extra Food',
      category: 'Food',
      priority: 'recommended',
      description: 'High-energy, heat-stable foods',
    },
    {
      name: 'First Aid Kit',
      category: 'Safety',
      priority: 'essential',
      description: 'Include heat exhaustion treatment',
    },
  ],
  'water sports': [
    {
      name: 'Life Jacket',
      category: 'Safety',
      priority: 'essential',
      description: 'Coast Guard approved PFD',
    },
    {
      name: 'Whistle',
      category: 'Safety',
      priority: 'essential',
      description: 'Emergency signaling',
    },
    {
      name: 'Dry Bag',
      category: 'Storage',
      priority: 'essential',
      description: 'Waterproof gear storage',
    },
    {
      name: 'Quick-dry Clothing',
      category: 'Clothing',
      priority: 'recommended',
      description: 'Synthetic or merino wool',
    },
    {
      name: 'Water Shoes',
      category: 'Footwear',
      priority: 'recommended',
      description: 'Protection and traction on wet surfaces',
    },
    {
      name: 'Sun Protection',
      category: 'Safety',
      priority: 'essential',
      alternatives: ['Hat', 'Sunglasses', 'UV Shirt'],
    },
    {
      name: 'First Aid Kit',
      category: 'Safety',
      priority: 'essential',
      description: 'Waterproof first aid supplies',
    },
    {
      name: 'Throw Rope',
      category: 'Safety',
      priority: 'recommended',
      description: 'For water rescue',
    },
    {
      name: 'Waterproof Headlamp',
      category: 'Lighting',
      priority: 'recommended',
      description: 'For low-light conditions',
    },
  ],
  skiing: [
    {
      name: 'Skis',
      category: 'Equipment',
      priority: 'essential',
      description: 'Appropriate for terrain and conditions',
    },
    {
      name: 'Ski Boots',
      category: 'Footwear',
      priority: 'essential',
      description: 'Properly fitted ski boots',
    },
    {
      name: 'Ski Poles',
      category: 'Equipment',
      priority: 'essential',
      description: 'Correct length for skier',
    },
    {
      name: 'Helmet',
      category: 'Safety',
      priority: 'essential',
      description: 'Ski or snowboard helmet',
    },
    {
      name: 'Goggles',
      category: 'Safety',
      priority: 'essential',
      description: 'Eye protection and visibility',
    },
    {
      name: 'Base Layers',
      category: 'Clothing',
      priority: 'essential',
      description: 'Moisture-wicking thermal layers',
    },
    {
      name: 'Insulated Jacket',
      category: 'Clothing',
      priority: 'essential',
      description: 'Ski jacket or layering system',
    },
    {
      name: 'Ski Gloves',
      category: 'Clothing',
      priority: 'essential',
      description: 'Waterproof insulated gloves',
    },
    {
      name: 'Avalanche Safety Gear',
      category: 'Safety',
      priority: 'essential',
      description: 'Beacon, probe, shovel for backcountry',
    },
    {
      name: 'First Aid Kit',
      category: 'Safety',
      priority: 'recommended',
      description: 'Cold weather first aid',
    },
  ],
  custom: [
    // For custom activity types, provide general essentials
    {
      name: 'First Aid Kit',
      category: 'Safety',
      priority: 'essential',
      description: 'Basic medical supplies',
    },
    {
      name: 'Navigation Tools',
      category: 'Navigation',
      priority: 'essential',
      alternatives: ['Map', 'Compass', 'GPS'],
    },
    {
      name: 'Emergency Shelter',
      category: 'Safety',
      priority: 'recommended',
      alternatives: ['Emergency Blanket', 'Bivy'],
    },
    {
      name: 'Lighting',
      category: 'Safety',
      priority: 'essential',
      alternatives: ['Headlamp', 'Flashlight'],
    },
    {
      name: 'Water',
      category: 'Hydration',
      priority: 'essential',
      description: 'Adequate water for activity duration',
    },
    {
      name: 'Food',
      category: 'Food',
      priority: 'essential',
      description: 'Energy for planned activity',
    },
  ],
};

export class GearGapAnalysisService {
  /**
   * Analyzes a pack to identify missing essential items for a specific activity
   */
  public analyzeGearGap(
    existingItems: Array<{ name: string; category: string }>,
    activityType: PackCategory,
  ): GearGapAnalysis {
    const essentialItems =
      ESSENTIAL_ITEMS_BY_ACTIVITY[activityType] || ESSENTIAL_ITEMS_BY_ACTIVITY.custom;

    // Create a map of existing items for quick lookup
    const existingItemsMap = new Map<string, boolean>();
    existingItems.forEach((item) => {
      // Normalize item names for comparison
      const normalizedName = this.normalizeItemName(item.name);
      existingItemsMap.set(normalizedName, true);

      // Also check category for broad matches
      existingItemsMap.set(this.normalizeItemName(item.category), true);
    });

    // Find missing items
    const missingItems: EssentialItem[] = [];
    essentialItems.forEach((essentialItem) => {
      const hasItem = this.checkIfItemExists(essentialItem, existingItemsMap);
      if (!hasItem) {
        missingItems.push(essentialItem);
      }
    });

    // Group missing items by category
    const missingByCategory: Record<string, EssentialItem[]> = {};
    missingItems.forEach((item) => {
      if (!missingByCategory[item.category]) {
        missingByCategory[item.category] = [];
      }
      missingByCategory[item.category].push(item);
    });

    // Calculate completion percentage
    const totalEssentials = essentialItems.length;
    const missingCount = missingItems.length;
    const completionPercentage = Math.round(
      ((totalEssentials - missingCount) / totalEssentials) * 100,
    );

    // Calculate summary by priority
    const summary = {
      essentialMissing: missingItems.filter((item) => item.priority === 'essential').length,
      recommendedMissing: missingItems.filter((item) => item.priority === 'recommended').length,
      optionalMissing: missingItems.filter((item) => item.priority === 'optional').length,
    };

    return {
      activityType,
      missingItems,
      missingByCategory,
      completionPercentage,
      summary,
    };
  }

  /**
   * Normalize item names for comparison
   */
  private normalizeItemName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Check if an essential item exists in the pack
   */
  private checkIfItemExists(
    essentialItem: EssentialItem,
    existingItemsMap: Map<string, boolean>,
  ): boolean {
    // Check exact name match
    const normalizedEssentialName = this.normalizeItemName(essentialItem.name);
    if (existingItemsMap.has(normalizedEssentialName)) {
      return true;
    }

    // Check alternatives
    if (essentialItem.alternatives) {
      for (const alternative of essentialItem.alternatives) {
        const normalizedAlternative = this.normalizeItemName(alternative);
        if (existingItemsMap.has(normalizedAlternative)) {
          return true;
        }
      }
    }

    // Check for partial matches in category
    const categoryName = this.normalizeItemName(essentialItem.category);
    if (existingItemsMap.has(categoryName)) {
      return true;
    }

    // Check for keyword matches
    const keywords = normalizedEssentialName.split(' ');
    for (const [existingItem] of existingItemsMap) {
      for (const keyword of keywords) {
        if (keyword.length > 3 && existingItem.includes(keyword)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get all available activity types and their essential item counts
   */
  public getActivityTypes(): Array<{
    type: PackCategory;
    essentialCount: number;
    recommendedCount: number;
    totalCount: number;
  }> {
    return Object.entries(ESSENTIAL_ITEMS_BY_ACTIVITY).map(([type, items]) => ({
      type: type as PackCategory,
      essentialCount: items.filter((item) => item.priority === 'essential').length,
      recommendedCount: items.filter((item) => item.priority === 'recommended').length,
      totalCount: items.length,
    }));
  }
}
