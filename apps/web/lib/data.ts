import type {
  CatalogItem,
  CatalogListResponse,
  FeedResponse,
  Guide,
  Notification,
  PackItem,
  PackListResponse,
  PackWithWeights,
  Post,
  Trip,
  User,
  WeightUnit,
} from './types';

// ── Weight helpers ───────────────────────────────────────────────────────────

export function toGrams(weight: number, unit: WeightUnit): number {
  switch (unit) {
    case 'oz':
      return Math.round(weight * 28.3495);
    case 'kg':
      return Math.round(weight * 1000);
    case 'lb':
      return Math.round(weight * 453.592);
    default:
      return weight;
  }
}

export function fromGrams(grams: number, unit: WeightUnit): number {
  switch (unit) {
    case 'oz':
      return Math.round((grams / 28.3495) * 10) / 10;
    case 'kg':
      return Math.round((grams / 1000) * 100) / 100;
    case 'lb':
      return Math.round((grams / 453.592) * 10) / 10;
    default:
      return grams;
  }
}

export function formatWeight(grams: number, unit: WeightUnit): string {
  const value = fromGrams(grams, unit);
  return `${value}${unit}`;
}

export function gramsToLbs(grams: number): string {
  const lbs = grams / 453.592;
  const wholeLbs = Math.floor(lbs);
  const oz = Math.round((lbs - wholeLbs) * 16);
  if (oz === 0) return `${wholeLbs} lbs`;
  return `${wholeLbs}.${oz} lbs`;
}

export type WeightClass = 'ultralight' | 'lightweight' | 'standard';

export function weightClass(grams: number): WeightClass {
  if (grams < 100) return 'ultralight';
  if (grams < 300) return 'lightweight';
  return 'standard';
}

// ── Simulated network delay ──────────────────────────────────────────────────

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Mock Current User ────────────────────────────────────────────────────────

export const currentUser: User = {
  id: 1,
  email: 'alex@packrat.app',
  firstName: 'Alex',
  lastName: 'Rivera',
  role: 'USER',
  emailVerified: true,
  avatarUrl: null,
};

// ── Mock Pack Items ──────────────────────────────────────────────────────────

const now = new Date().toISOString();

function createPackItem(
  overrides: Partial<PackItem> & Pick<PackItem, 'id' | 'name' | 'weight' | 'category' | 'packId'>,
): PackItem {
  return {
    description: null,
    weightUnit: 'g',
    quantity: 1,
    consumable: false,
    worn: false,
    image: null,
    notes: null,
    catalogItemId: null,
    userId: 1,
    deleted: false,
    isAIGenerated: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const pctItems: PackItem[] = [
  createPackItem({
    id: 'pi-1',
    name: 'Zpacks Solplex Tent',
    weight: 340,
    category: 'shelter',
    packId: 'pack-1',
    catalogItemId: 2,
  }),
  createPackItem({
    id: 'pi-2',
    name: 'Zpacks Arc Blast 55L',
    weight: 510,
    category: 'shelter',
    packId: 'pack-1',
    catalogItemId: 6,
  }),
  createPackItem({
    id: 'pi-3',
    name: 'Enlightened Equipment Revelation 20°',
    weight: 397,
    category: 'sleep',
    packId: 'pack-1',
    catalogItemId: 8,
  }),
  createPackItem({
    id: 'pi-4',
    name: 'Therm-a-Rest NeoAir XLite',
    weight: 340,
    category: 'sleep',
    packId: 'pack-1',
    catalogItemId: 10,
  }),
  createPackItem({
    id: 'pi-5',
    name: 'Garmin inReach Mini 2',
    weight: 100,
    category: 'electronics',
    packId: 'pack-1',
    catalogItemId: 11,
  }),
  createPackItem({
    id: 'pi-6',
    name: 'MSR Pocket Rocket 2',
    weight: 73,
    category: 'kitchen',
    packId: 'pack-1',
    catalogItemId: 13,
  }),
  createPackItem({
    id: 'pi-7',
    name: 'Snow Peak Titan Kettle',
    weight: 156,
    category: 'kitchen',
    packId: 'pack-1',
    catalogItemId: 14,
  }),
  createPackItem({
    id: 'pi-8',
    name: 'Katadyn BeFree 1.0L',
    weight: 60,
    category: 'water',
    packId: 'pack-1',
    catalogItemId: 15,
  }),
  createPackItem({
    id: 'pi-9',
    name: 'OR Helium Wind Jacket',
    weight: 113,
    category: 'clothing',
    packId: 'pack-1',
    catalogItemId: 17,
    worn: true,
  }),
  createPackItem({
    id: 'pi-10',
    name: 'Black Diamond Spot 400-R',
    weight: 86,
    category: 'electronics',
    packId: 'pack-1',
    catalogItemId: 19,
  }),
];

const weekendItems: PackItem[] = [
  createPackItem({
    id: 'pi-20',
    name: 'Big Agnes Copper Spur HV UL2',
    weight: 997,
    category: 'shelter',
    packId: 'pack-2',
    catalogItemId: 4,
  }),
  createPackItem({
    id: 'pi-21',
    name: 'Osprey Exos 58',
    weight: 1120,
    category: 'shelter',
    packId: 'pack-2',
    catalogItemId: 7,
  }),
  createPackItem({
    id: 'pi-22',
    name: 'Western Mountaineering Ohm 20°',
    weight: 680,
    category: 'sleep',
    packId: 'pack-2',
    catalogItemId: 9,
  }),
  createPackItem({
    id: 'pi-23',
    name: 'Therm-a-Rest NeoAir XLite',
    weight: 340,
    category: 'sleep',
    packId: 'pack-2',
    catalogItemId: 10,
  }),
  createPackItem({
    id: 'pi-24',
    name: 'Garmin GPSMAP 67i',
    weight: 230,
    category: 'electronics',
    packId: 'pack-2',
    catalogItemId: 12,
  }),
  createPackItem({
    id: 'pi-25',
    name: 'MSR Pocket Rocket 2',
    weight: 73,
    category: 'kitchen',
    packId: 'pack-2',
    catalogItemId: 13,
  }),
  createPackItem({
    id: 'pi-26',
    name: 'Snow Peak Titan Kettle',
    weight: 156,
    category: 'kitchen',
    packId: 'pack-2',
    catalogItemId: 14,
  }),
  createPackItem({
    id: 'pi-27',
    name: 'Katadyn BeFree 1.0L',
    weight: 60,
    category: 'water',
    packId: 'pack-2',
    catalogItemId: 15,
  }),
  createPackItem({
    id: 'pi-28',
    name: 'Merrell Trail Glove 7',
    weight: 454,
    category: 'clothing',
    packId: 'pack-2',
    catalogItemId: 16,
    worn: true,
  }),
  createPackItem({
    id: 'pi-29',
    name: 'Patagonia Nano Puff',
    weight: 312,
    category: 'clothing',
    packId: 'pack-2',
    catalogItemId: 18,
  }),
  createPackItem({
    id: 'pi-30',
    name: 'Black Diamond Spot 400-R',
    weight: 86,
    category: 'electronics',
    packId: 'pack-2',
    catalogItemId: 19,
  }),
];

const alpineItems: PackItem[] = [
  createPackItem({
    id: 'pi-40',
    name: 'Zpacks Altaplex',
    weight: 454,
    category: 'shelter',
    packId: 'pack-3',
    catalogItemId: 3,
  }),
  createPackItem({
    id: 'pi-41',
    name: 'Zpacks Arc Blast 55L',
    weight: 510,
    category: 'shelter',
    packId: 'pack-3',
    catalogItemId: 6,
  }),
  createPackItem({
    id: 'pi-42',
    name: 'Enlightened Equipment Revelation 20°',
    weight: 397,
    category: 'sleep',
    packId: 'pack-3',
    catalogItemId: 8,
  }),
  createPackItem({
    id: 'pi-43',
    name: 'Therm-a-Rest NeoAir XLite',
    weight: 340,
    category: 'sleep',
    packId: 'pack-3',
    catalogItemId: 10,
  }),
  createPackItem({
    id: 'pi-44',
    name: 'Garmin inReach Mini 2',
    weight: 100,
    category: 'electronics',
    packId: 'pack-3',
    catalogItemId: 11,
  }),
  createPackItem({
    id: 'pi-45',
    name: 'MSR Pocket Rocket 2',
    weight: 73,
    category: 'kitchen',
    packId: 'pack-3',
    catalogItemId: 13,
  }),
  createPackItem({
    id: 'pi-46',
    name: 'Katadyn BeFree 1.0L',
    weight: 60,
    category: 'water',
    packId: 'pack-3',
    catalogItemId: 15,
  }),
  createPackItem({
    id: 'pi-47',
    name: 'OR Helium Wind Jacket',
    weight: 113,
    category: 'clothing',
    packId: 'pack-3',
    catalogItemId: 17,
    worn: true,
  }),
  createPackItem({
    id: 'pi-48',
    name: 'Patagonia Nano Puff',
    weight: 312,
    category: 'clothing',
    packId: 'pack-3',
    catalogItemId: 18,
  }),
  createPackItem({
    id: 'pi-49',
    name: 'Black Diamond Spot 400-R',
    weight: 86,
    category: 'electronics',
    packId: 'pack-3',
    catalogItemId: 19,
  }),
];

// ── Mock Packs ───────────────────────────────────────────────────────────────

function calcWeights(items: PackItem[]): { totalWeight: number; baseWeight: number } {
  let total = 0;
  let base = 0;
  for (const item of items) {
    const w = toGrams(item.weight, item.weightUnit) * item.quantity;
    total += w;
    if (!item.consumable && !item.worn) {
      base += w;
    }
  }
  return { totalWeight: total, baseWeight: base };
}

const pctWeights = calcWeights(pctItems);
const weekendWeights = calcWeights(weekendItems);
const alpineWeights = calcWeights(alpineItems);

export const mockPacks: PackWithWeights[] = [
  {
    id: 'pack-1',
    userId: 1,
    name: '3-Season PCT Thru-Hike',
    description:
      'Optimized for the Pacific Crest Trail, spring through fall. Sub-10lb base weight.',
    category: 'backpacking',
    isPublic: true,
    image: null,
    tags: ['PCT', 'thru-hike', 'ultralight', '3-season'],
    deleted: false,
    isAIGenerated: false,
    createdAt: '2024-03-15T10:30:00Z',
    updatedAt: '2024-07-28T14:22:00Z',
    items: pctItems,
    ...pctWeights,
  },
  {
    id: 'pack-2',
    userId: 1,
    name: 'Weekend Backpacking',
    description: 'Comfortable 3-day base for Sierra trips. Prioritizes comfort over weight.',
    category: 'backpacking',
    isPublic: false,
    image: null,
    tags: ['weekend', 'sierra', '3-day', 'comfort'],
    deleted: false,
    isAIGenerated: false,
    createdAt: '2024-05-01T08:15:00Z',
    updatedAt: '2024-07-25T11:45:00Z',
    items: weekendItems,
    ...weekendWeights,
  },
  {
    id: 'pack-3',
    userId: 1,
    name: 'Alpine Summit Push',
    description: 'Fast and light mountaineering kit for technical approaches and summit pushes.',
    category: 'climbing',
    isPublic: true,
    image: null,
    tags: ['alpine', 'summit', 'fast-and-light', 'mountaineering'],
    deleted: false,
    isAIGenerated: false,
    createdAt: '2024-07-20T16:00:00Z',
    updatedAt: '2024-07-29T09:30:00Z',
    items: alpineItems,
    ...alpineWeights,
  },
];

// ── Mock Templates ───────────────────────────────────────────────────────────

export const mockTemplates: PackWithWeights[] = [
  {
    id: 'tmpl-1',
    userId: 0,
    name: 'Desert Thru-Hike Starter',
    description:
      'Minimal kit optimized for hot, dry conditions. Focus on sun protection and water capacity.',
    category: 'desert',
    isPublic: true,
    image: null,
    tags: ['desert', 'template', 'starter', 'hot-weather'],
    deleted: false,
    isAIGenerated: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    items: [],
    totalWeight: 3629,
    baseWeight: 3200,
  },
  {
    id: 'tmpl-2',
    userId: 0,
    name: 'Winter Mountaineering',
    description:
      'Cold weather alpine setup for sub-freezing conditions. Includes insulation layers.',
    category: 'winter',
    isPublic: true,
    image: null,
    tags: ['winter', 'alpine', 'template', 'cold-weather'],
    deleted: false,
    isAIGenerated: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    items: [],
    totalWeight: 6804,
    baseWeight: 5800,
  },
  {
    id: 'tmpl-3',
    userId: 0,
    name: 'Ultralight Day Hike',
    description: 'Minimal essentials for a fast day on the trail. 10 essentials coverage.',
    category: 'hiking',
    isPublic: true,
    image: null,
    tags: ['day-hike', 'ultralight', 'template', 'essentials'],
    deleted: false,
    isAIGenerated: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    items: [],
    totalWeight: 2200,
    baseWeight: 1800,
  },
];

// ── Mock Trips ───────────────────────────────────────────────────────────────

export const mockTrips: Trip[] = [
  {
    id: 'trip-1',
    name: 'John Muir Trail Section',
    description: 'Classic JMT section from Yosemite Valley to Tuolumne Meadows via Half Dome.',
    notes:
      'Bear canister required. Resupply box sent to Tuolumne Lodge. Permit secured for August 10 start.',
    location: {
      latitude: 37.7456,
      longitude: -119.5936,
      name: 'Yosemite Valley to Tuolumne Meadows',
    },
    startDate: '2024-08-10',
    endDate: '2024-08-17',
    userId: 1,
    packId: 'pack-1',
    deleted: false,
    createdAt: '2024-06-15T09:00:00Z',
    updatedAt: '2024-07-28T16:30:00Z',
  },
  {
    id: 'trip-2',
    name: 'Enchantments Traverse',
    description: 'Core zone permit for the Enchantments loop in the Alpine Lakes Wilderness.',
    notes: 'Micro spikes packed, snow possible at higher elevations. Car shuttle arranged.',
    location: {
      latitude: 47.528,
      longitude: -120.826,
      name: 'Leavenworth, WA',
    },
    startDate: '2024-09-22',
    endDate: '2024-09-25',
    userId: 1,
    packId: 'pack-3',
    deleted: false,
    createdAt: '2024-07-01T14:00:00Z',
    updatedAt: '2024-07-25T10:15:00Z',
  },
  {
    id: 'trip-3',
    name: 'Lost Coast Trail',
    description: 'Remote Northern California coastline backpacking on the beach.',
    notes: 'Check tide tables. Bear canister required. Water sources limited.',
    location: {
      latitude: 40.4405,
      longitude: -124.4032,
      name: 'Mattole to Black Sands Beach',
    },
    startDate: '2024-10-05',
    endDate: '2024-10-08',
    userId: 1,
    packId: 'pack-2',
    deleted: false,
    createdAt: '2024-08-01T11:30:00Z',
    updatedAt: '2024-08-01T11:30:00Z',
  },
];

// ── Mock Catalog Items ───────────────────────────────────────────────────────

export const mockCatalogItems: CatalogItem[] = [
  {
    id: 1,
    name: 'Duplex Tent',
    productUrl: 'https://zpacks.com/products/duplex-tent',
    sku: 'ZP-DPX-01',
    weight: 510,
    weightUnit: 'g',
    description:
      'Ultralight two-person DCF tent. 510g total with stakes. Industry-leading weight-to-space ratio.',
    categories: ['shelter', 'tents'],
    images: ['/images/zpacks-duplex.jpg'],
    model: 'Duplex',
    ratingValue: 4.8,
    color: 'Olive Drab',
    size: '2P',
    price: 649,
    currency: 'USD',
    availability: 'in_stock',
    seller: 'Zpacks',
    material: 'DCF (Dyneema Composite Fabric)',
    reviewCount: 342,
    createdAt: new Date('2023-01-15'),
    updatedAt: new Date('2024-07-01'),
  },
  {
    id: 2,
    name: 'Solplex Tent',
    productUrl: 'https://zpacks.com/products/solplex-tent',
    sku: 'ZP-SPX-01',
    weight: 340,
    weightUnit: 'g',
    description: 'Solo DCF trekking pole tent. Sub-12oz packed weight. Perfect for thru-hikers.',
    categories: ['shelter', 'tents'],
    images: ['/images/zpacks-solplex.jpg'],
    model: 'Solplex',
    ratingValue: 4.7,
    color: 'Olive Drab',
    size: '1P',
    price: 549,
    currency: 'USD',
    availability: 'in_stock',
    seller: 'Zpacks',
    material: 'DCF (Dyneema Composite Fabric)',
    reviewCount: 189,
    createdAt: new Date('2023-02-20'),
    updatedAt: new Date('2024-06-15'),
  },
  {
    id: 3,
    name: 'Altaplex Tent',
    productUrl: 'https://zpacks.com/products/altaplex-tent',
    sku: 'ZP-APX-01',
    weight: 454,
    weightUnit: 'g',
    description:
      'High-volume DCF solo shelter with gear loft. Maximum livability at minimum weight.',
    categories: ['shelter', 'tents'],
    images: ['/images/zpacks-altaplex.jpg'],
    model: 'Altaplex',
    ratingValue: 4.6,
    color: 'Olive Drab',
    size: '1P+',
    price: 599,
    currency: 'USD',
    availability: 'in_stock',
    seller: 'Zpacks',
    material: 'DCF (Dyneema Composite Fabric)',
    reviewCount: 156,
    createdAt: new Date('2023-03-10'),
    updatedAt: new Date('2024-05-20'),
  },
  {
    id: 4,
    name: 'Copper Spur HV UL2',
    productUrl: 'https://bigagnes.com/products/copper-spur-hv-ul2',
    sku: 'BA-CSUL2-01',
    weight: 997,
    weightUnit: 'g',
    description:
      'Two-person freestanding ultralight backpacking tent. High volume design with excellent ventilation.',
    categories: ['shelter', 'tents'],
    images: ['/images/ba-copper-spur.jpg'],
    model: 'Copper Spur HV UL2',
    ratingValue: 4.9,
    color: 'Orange/Gray',
    size: '2P',
    price: 549,
    currency: 'USD',
    availability: 'in_stock',
    seller: 'Big Agnes',
    material: 'Silicone-treated ripstop nylon',
    reviewCount: 892,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2024-07-15'),
  },
  {
    id: 5,
    name: 'Fly Creek HV UL1',
    productUrl: 'https://bigagnes.com/products/fly-creek-hv-ul1',
    sku: 'BA-FCUL1-01',
    weight: 680,
    weightUnit: 'g',
    description:
      'Solo ultralight freestanding tent with fast pitch. Excellent for solo backpackers.',
    categories: ['shelter', 'tents'],
    images: ['/images/ba-fly-creek.jpg'],
    model: 'Fly Creek HV UL1',
    ratingValue: 4.7,
    color: 'Gray/Gold',
    size: '1P',
    price: 399,
    currency: 'USD',
    availability: 'in_stock',
    seller: 'Big Agnes',
    material: 'Silicone-treated ripstop nylon',
    reviewCount: 445,
    createdAt: new Date('2023-01-10'),
    updatedAt: new Date('2024-06-01'),
  },
  {
    id: 6,
    name: 'Arc Blast 55L',
    productUrl: 'https://zpacks.com/products/arc-blast-55l',
    sku: 'ZP-AB55-01',
    weight: 510,
    weightUnit: 'g',
    description:
      'DCF frameless backpack with hip belt. 55L capacity. Perfect for ultralight thru-hiking.',
    categories: ['packs', 'backpacks'],
    images: ['/images/zpacks-arc-blast.jpg'],
    model: 'Arc Blast',
    ratingValue: 4.5,
    color: 'Olive Drab',
    size: '55L',
    price: 399,
    currency: 'USD',
    availability: 'in_stock',
    seller: 'Zpacks',
    material: 'DCF (Dyneema Composite Fabric)',
    reviewCount: 267,
    createdAt: new Date('2023-04-01'),
    updatedAt: new Date('2024-07-20'),
  },
  {
    id: 7,
    name: 'Exos 58',
    productUrl: 'https://osprey.com/products/exos-58',
    sku: 'OSP-EX58-01',
    weight: 1120,
    weightUnit: 'g',
    description: 'Ventilated ultralight pack with AirSpeed suspension. Excellent load transfer.',
    categories: ['packs', 'backpacks'],
    images: ['/images/osprey-exos.jpg'],
    model: 'Exos 58',
    ratingValue: 4.8,
    color: 'Tunnel Green',
    size: '58L',
    price: 240,
    currency: 'USD',
    availability: 'in_stock',
    seller: 'Osprey',
    material: 'Ripstop nylon',
    reviewCount: 1245,
    createdAt: new Date('2023-01-05'),
    updatedAt: new Date('2024-08-01'),
  },
  {
    id: 8,
    name: 'Revelation 20° Quilt',
    productUrl: 'https://enlightenedequipment.com/revelation-apex-quilt',
    sku: 'EE-REV20-01',
    weight: 397,
    weightUnit: 'g',
    description:
      '900-fill power down quilt, 20°F rated. Ultralight and compressible. Versatile attachment system.',
    categories: ['sleep', 'quilts'],
    images: ['/images/ee-revelation.jpg'],
    model: 'Revelation',
    ratingValue: 4.9,
    color: 'Forest/Charcoal',
    size: 'Regular/Wide',
    price: 385,
    currency: 'USD',
    availability: 'in_stock',
    seller: 'Enlightened Equipment',
    material: '900-fill goose down',
    reviewCount: 678,
    createdAt: new Date('2023-02-01'),
    updatedAt: new Date('2024-07-10'),
  },
  {
    id: 9,
    name: 'Ohm 20° Sleeping Bag',
    productUrl: 'https://westernmountaineering.com/ohm',
    sku: 'WM-OHM20-01',
    weight: 680,
    weightUnit: 'g',
    description:
      '900+ fill goose down mummy bag, 20°F comfort. Premium construction and materials.',
    categories: ['sleep', 'sleeping-bags'],
    images: ['/images/wm-ohm.jpg'],
    model: 'Ohm',
    ratingValue: 5.0,
    color: 'Sage',
    size: 'Regular',
    price: 695,
    currency: 'USD',
    availability: 'in_stock',
    seller: 'Western Mountaineering',
    material: '900+ fill goose down',
    reviewCount: 234,
    createdAt: new Date('2023-01-20'),
    updatedAt: new Date('2024-06-20'),
  },
  {
    id: 10,
    name: 'NeoAir XLite Max SV',
    productUrl: 'https://thermarest.com/neoair-xlite-max-sv',
    sku: 'TAR-NAXL-01',
    weight: 340,
    weightUnit: 'g',
    description:
      'R-value 4.5 ultralight air pad. Rapid inflate/deflate with SpeedValve. 3-season comfort.',
    categories: ['sleep', 'pads'],
    images: ['/images/thermarest-neoair.jpg'],
    model: 'NeoAir XLite Max SV',
    ratingValue: 4.6,
    color: 'Marigold',
    size: 'Regular',
    price: 219,
    currency: 'USD',
    availability: 'in_stock',
    seller: 'Therm-a-Rest',
    material: '75D polyester',
    reviewCount: 567,
    createdAt: new Date('2023-03-01'),
    updatedAt: new Date('2024-07-25'),
  },
  {
    id: 11,
    name: 'inReach Mini 2',
    productUrl: 'https://garmin.com/inreach-mini-2',
    sku: 'GAR-IRM2-01',
    weight: 100,
    weightUnit: 'g',
    description: 'Satellite communicator with two-way messaging and SOS. Compact and lightweight.',
    categories: ['electronics', 'communication'],
    images: ['/images/garmin-inreach-mini.jpg'],
    model: 'inReach Mini 2',
    ratingValue: 4.7,
    color: 'Flame Red',
    size: null,
    price: 349,
    currency: 'USD',
    availability: 'in_stock',
    seller: 'Garmin',
    material: 'Fiber-reinforced polymer',
    reviewCount: 1123,
    createdAt: new Date('2023-05-01'),
    updatedAt: new Date('2024-08-01'),
  },
  {
    id: 12,
    name: 'GPSMAP 67i',
    productUrl: 'https://garmin.com/gpsmap-67i',
    sku: 'GAR-GPS67I-01',
    weight: 230,
    weightUnit: 'g',
    description: 'Multi-GNSS handheld GPS with inReach satellite comms. Preloaded topo maps.',
    categories: ['electronics', 'navigation'],
    images: ['/images/garmin-gpsmap.jpg'],
    model: 'GPSMAP 67i',
    ratingValue: 4.8,
    color: 'Black',
    size: null,
    price: 599,
    currency: 'USD',
    availability: 'in_stock',
    seller: 'Garmin',
    material: 'Fiber-reinforced polymer',
    reviewCount: 456,
    createdAt: new Date('2023-06-01'),
    updatedAt: new Date('2024-07-30'),
  },
  {
    id: 13,
    name: 'Pocket Rocket 2',
    productUrl: 'https://msrgear.com/pocket-rocket-2',
    sku: 'MSR-PR2-01',
    weight: 73,
    weightUnit: 'g',
    description: 'Ultra-compact canister stove. Boils 1L in 3.5 min. Award-winning design.',
    categories: ['kitchen', 'stoves'],
    images: ['/images/msr-pocket-rocket.jpg'],
    model: 'Pocket Rocket 2',
    ratingValue: 4.8,
    color: 'Red',
    size: null,
    price: 49,
    currency: 'USD',
    availability: 'in_stock',
    seller: 'MSR',
    material: 'Stainless steel/aluminum',
    reviewCount: 2345,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2024-06-01'),
  },
  {
    id: 14,
    name: 'Titan Kettle 750ml',
    productUrl: 'https://snowpeak.com/titan-kettle-750',
    sku: 'SP-TK750-01',
    weight: 156,
    weightUnit: 'g',
    description: 'Titanium single-wall cook pot. Nesting lid. Ultralight and durable.',
    categories: ['kitchen', 'cookware'],
    images: ['/images/snowpeak-titan.jpg'],
    model: 'Titan Kettle',
    ratingValue: 4.7,
    color: 'Titanium',
    size: '750ml',
    price: 75,
    currency: 'USD',
    availability: 'in_stock',
    seller: 'Snow Peak',
    material: 'Titanium',
    reviewCount: 389,
    createdAt: new Date('2023-02-15'),
    updatedAt: new Date('2024-05-01'),
  },
  {
    id: 15,
    name: 'BeFree 1.0L',
    productUrl: 'https://katadyn.com/befree-1l',
    sku: 'KAT-BF1L-01',
    weight: 60,
    weightUnit: 'g',
    description: 'Soft-flask filter system. 1000ml/min flow rate. Ultra-fast filtration.',
    categories: ['water', 'filters'],
    images: ['/images/katadyn-befree.jpg'],
    model: 'BeFree',
    ratingValue: 4.5,
    color: 'Clear',
    size: '1.0L',
    price: 49,
    currency: 'USD',
    availability: 'in_stock',
    seller: 'Katadyn',
    material: 'Soft flask with hollow fiber filter',
    reviewCount: 1567,
    createdAt: new Date('2023-03-20'),
    updatedAt: new Date('2024-07-15'),
  },
  {
    id: 16,
    name: 'Trail Glove 7',
    productUrl: 'https://merrell.com/trail-glove-7',
    sku: 'MER-TG7-01',
    weight: 454,
    weightUnit: 'g',
    description: 'Minimal barefoot-style trail runner. Zero drop. Vibram outsole for grip.',
    categories: ['clothing', 'footwear'],
    images: ['/images/merrell-trail-glove.jpg'],
    model: 'Trail Glove 7',
    ratingValue: 4.6,
    color: 'Black/Lime',
    size: '10 US',
    price: 130,
    currency: 'USD',
    availability: 'in_stock',
    seller: 'Merrell',
    material: 'Mesh/Vibram rubber',
    reviewCount: 892,
    createdAt: new Date('2023-04-01'),
    updatedAt: new Date('2024-08-01'),
  },
  {
    id: 17,
    name: 'Helium Wind Jacket',
    productUrl: 'https://outdoorresearch.com/helium-wind-jacket',
    sku: 'OR-HWJ-01',
    weight: 113,
    weightUnit: 'g',
    description: 'Ultralight packable wind jacket. Under 4oz. Pertex Quantum Air fabric.',
    categories: ['clothing', 'jackets'],
    images: ['/images/or-helium-wind.jpg'],
    model: 'Helium Wind',
    ratingValue: 4.7,
    color: 'Baltic',
    size: 'M',
    price: 149,
    currency: 'USD',
    availability: 'in_stock',
    seller: 'Outdoor Research',
    material: 'Pertex Quantum Air',
    reviewCount: 445,
    createdAt: new Date('2023-05-10'),
    updatedAt: new Date('2024-06-20'),
  },
  {
    id: 18,
    name: 'Nano Puff Jacket',
    productUrl: 'https://patagonia.com/nano-puff-jacket',
    sku: 'PAT-NPJ-01',
    weight: 312,
    weightUnit: 'g',
    description: '60g PrimaLoft insulation. Compresses to its chest pocket. Warm and packable.',
    categories: ['clothing', 'insulation'],
    images: ['/images/patagonia-nano-puff.jpg'],
    model: 'Nano Puff',
    ratingValue: 4.8,
    color: 'Nouveau Green',
    size: 'M',
    price: 259,
    currency: 'USD',
    availability: 'in_stock',
    seller: 'Patagonia',
    material: 'PrimaLoft Gold Eco',
    reviewCount: 3456,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2024-07-01'),
  },
  {
    id: 19,
    name: 'Spot 400-R',
    productUrl: 'https://blackdiamond.com/spot-400-r',
    sku: 'BD-S400R-01',
    weight: 86,
    weightUnit: 'g',
    description: 'Rechargeable headlamp, 400 lumens, IPX8 waterproof. USB-C charging.',
    categories: ['electronics', 'lighting'],
    images: ['/images/bd-spot-400.jpg'],
    model: 'Spot 400-R',
    ratingValue: 4.6,
    color: 'Graphite',
    size: null,
    price: 55,
    currency: 'USD',
    availability: 'in_stock',
    seller: 'Black Diamond',
    material: 'Polycarbonate',
    reviewCount: 1234,
    createdAt: new Date('2023-06-01'),
    updatedAt: new Date('2024-08-01'),
  },
  {
    id: 20,
    name: 'Ultralight Stuff Sack 4L',
    productUrl: 'https://seatosummit.com/ultralight-stuff-sack',
    sku: 'S2S-USS4L-01',
    weight: 25,
    weightUnit: 'g',
    description:
      'Ultra-packable nylon stuff sack. Multiple colors. Silicone-coated for water resistance.',
    categories: ['storage', 'stuff-sacks'],
    images: ['/images/s2s-stuff-sack.jpg'],
    model: 'Ultralight Stuff Sack',
    ratingValue: 4.5,
    color: 'Blue',
    size: '4L',
    price: 18,
    currency: 'USD',
    availability: 'in_stock',
    seller: 'Sea to Summit',
    material: 'Sil-nylon',
    reviewCount: 567,
    createdAt: new Date('2023-02-01'),
    updatedAt: new Date('2024-05-15'),
  },
];

// ── Mock Feed Posts ──────────────────────────────────────────────────────────

export const mockPosts: Post[] = [
  {
    id: 1,
    userId: 2,
    caption:
      'Finally dialed in my SoCal desert PCT setup. 6.5lb base weight! The key was switching to a tarp and going stoveless for the desert section.',
    images: [],
    createdAt: '2024-07-28T14:30:00Z',
    updatedAt: '2024-07-28T14:30:00Z',
    author: { id: 2, firstName: 'Sarah', lastName: 'Chen' },
    likeCount: 142,
    commentCount: 23,
    likedByMe: false,
  },
  {
    id: 2,
    userId: 3,
    caption:
      'Wind River High Route gear list. This is what 4000+ miles of thru-hiking has taught me. Every gram has been earned.',
    images: [],
    createdAt: '2024-07-25T09:15:00Z',
    updatedAt: '2024-07-25T09:15:00Z',
    author: { id: 3, firstName: 'Jake', lastName: 'Morrison' },
    likeCount: 89,
    commentCount: 11,
    likedByMe: true,
  },
  {
    id: 3,
    userId: 4,
    caption:
      'AT weekend basecamp setup. Not the lightest but extremely comfortable for section hiking with my kids.',
    images: [],
    createdAt: '2024-07-22T16:45:00Z',
    updatedAt: '2024-07-22T16:45:00Z',
    author: { id: 4, firstName: 'Maria', lastName: 'Santos' },
    likeCount: 54,
    commentCount: 7,
    likedByMe: false,
  },
  {
    id: 4,
    userId: 5,
    caption:
      'Wonderland Trail FKT attempt kit. Shaved 2 lbs from last year. Going for sub-24 hours this time.',
    images: [],
    createdAt: '2024-07-20T11:00:00Z',
    updatedAt: '2024-07-20T11:00:00Z',
    author: { id: 5, firstName: 'Alex', lastName: 'Park' },
    likeCount: 211,
    commentCount: 38,
    likedByMe: true,
  },
  {
    id: 5,
    userId: 6,
    caption:
      "Zion Narrows overnighter loadout. Waterproof everything! Learned from experience that the river doesn't care about your gear.",
    images: [],
    createdAt: '2024-07-18T08:30:00Z',
    updatedAt: '2024-07-18T08:30:00Z',
    author: { id: 6, firstName: 'Jordan', lastName: 'Kim' },
    likeCount: 77,
    commentCount: 14,
    likedByMe: false,
  },
];

// ── Mock Guides ──────────────────────────────────────────────────────────────

export const mockGuides: Guide[] = [
  {
    id: 'g1',
    title: 'How to Build a Sub-10lb Pack',
    category: 'Ultralight Tips',
    readTime: '8 min',
    excerpt: 'The definitive guide to cutting weight without sacrificing safety or comfort.',
  },
  {
    id: 'g2',
    title: 'DCF vs Silnylon: Which Shelter Material Wins?',
    category: 'Gear Guides',
    readTime: '6 min',
    excerpt: 'An honest comparison of the two most popular ultralight shelter fabrics.',
  },
  {
    id: 'g3',
    title: 'Trip Planning for the PCT: A Complete Guide',
    category: 'Trip Planning',
    readTime: '15 min',
    excerpt:
      'Everything you need to know about permits, resupply, and gear for the Pacific Crest Trail.',
  },
  {
    id: 'g4',
    title: 'Down vs Synthetic: Sleep System Showdown',
    category: 'Gear Guides',
    readTime: '5 min',
    excerpt: 'When to choose down and when synthetic makes more sense.',
  },
  {
    id: 'g5',
    title: 'The 10 Essentials, Re-examined for Ultralighters',
    category: 'Ultralight Tips',
    readTime: '7 min',
    excerpt: 'How to cover all your bases while keeping weight minimal.',
  },
  {
    id: 'g6',
    title: 'Planning a JMT Permit Strategy',
    category: 'Trip Planning',
    readTime: '10 min',
    excerpt: 'Navigate the complex JMT permit system with our proven strategy.',
  },
  {
    id: 'g7',
    title: 'Water Treatment on the Trail',
    category: 'Gear Guides',
    readTime: '4 min',
    excerpt: 'Filters, UV, chemicals - which water treatment is right for you?',
  },
  {
    id: 'g8',
    title: 'Layering for Alpine Conditions',
    category: 'Ultralight Tips',
    readTime: '6 min',
    excerpt: 'The ultralight layering system that works in any conditions.',
  },
];

// ── Mock Notifications ───────────────────────────────────────────────────────

export const mockNotifications: Notification[] = [
  {
    id: 'n1',
    type: 'like',
    message: 'liked your PCT Thru-Hike pack',
    read: false,
    createdAt: '2024-07-29T10:30:00Z',
    actorName: 'Sarah Chen',
    actorAvatar: 'SC',
  },
  {
    id: 'n2',
    type: 'comment',
    message: 'commented on your pack: "Great quilt choice!"',
    read: false,
    createdAt: '2024-07-29T09:15:00Z',
    actorName: 'Jake Morrison',
    actorAvatar: 'JM',
  },
  {
    id: 'n3',
    type: 'follow',
    message: 'started following you',
    read: false,
    createdAt: '2024-07-28T16:45:00Z',
    actorName: 'Alex Park',
    actorAvatar: 'AP',
  },
  {
    id: 'n4',
    type: 'system',
    message: 'Your trip "JMT Section" starts in 2 weeks!',
    read: true,
    createdAt: '2024-07-27T08:00:00Z',
  },
  {
    id: 'n5',
    type: 'like',
    message: 'liked your Alpine Summit pack',
    read: true,
    createdAt: '2024-07-26T14:20:00Z',
    actorName: 'Maria Santos',
    actorAvatar: 'MS',
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// API Functions (Promise-based for TanStack Query)
// ══════════════════════════════════════════════════════════════════════════════

// ── User ─────────────────────────────────────────────────────────────────────

export async function fetchCurrentUser(): Promise<User> {
  await delay(200);
  return currentUser;
}

// ── Packs ────────────────────────────────────────────────────────────────────

export async function fetchPacks(page = 1, limit = 10): Promise<PackListResponse> {
  await delay(300);
  const packs = mockPacks.filter((p) => !p.deleted);
  return {
    packs,
    total: packs.length,
    page,
    limit,
    totalPages: Math.ceil(packs.length / limit),
  };
}

export async function fetchPackById(id: string): Promise<PackWithWeights | null> {
  await delay(200);
  return mockPacks.find((p) => p.id === id && !p.deleted) || null;
}

export async function fetchTemplates(): Promise<PackWithWeights[]> {
  await delay(250);
  return mockTemplates;
}

// ── Trips ────────────────────────────────────────────────────────────────────

export async function fetchTrips(): Promise<Trip[]> {
  await delay(250);
  return mockTrips.filter((t) => !t.deleted);
}

export async function fetchTripById(id: string): Promise<Trip | null> {
  await delay(200);
  return mockTrips.find((t) => t.id === id && !t.deleted) || null;
}

// ── Catalog ──────────────────────────────────────────────────────────────────

// biome-ignore lint/complexity/useMaxParams: pagination + filter params
export async function fetchCatalogItems(
  page = 1,
  limit = 20,
  search?: string,
  category?: string,
): Promise<CatalogListResponse> {
  await delay(300);
  let items = [...mockCatalogItems];

  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.seller?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q),
    );
  }

  if (category) {
    items = items.filter((item) => item.categories?.includes(category));
  }

  const start = (page - 1) * limit;
  const paginatedItems = items.slice(start, start + limit);

  return {
    items: paginatedItems,
    totalCount: items.length,
    page,
    limit,
    totalPages: Math.ceil(items.length / limit),
  };
}

export async function fetchCatalogItemById(id: number): Promise<CatalogItem | null> {
  await delay(200);
  return mockCatalogItems.find((item) => item.id === id) || null;
}

// ── Feed ─────────────────────────────────────────────────────────────────────

// biome-ignore lint/complexity/useMaxParams: pagination + filter params
export async function fetchFeed(
  page = 1,
  limit = 10,
  filter: 'trending' | 'recent' | 'following' = 'trending',
): Promise<FeedResponse> {
  await delay(300);
  const items = [...mockPosts];

  if (filter === 'trending') {
    items.sort((a, b) => b.likeCount - a.likeCount);
  } else if (filter === 'recent') {
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const start = (page - 1) * limit;
  const paginatedItems = items.slice(start, start + limit);

  return {
    items: paginatedItems,
    page,
    limit,
    total: items.length,
    totalPages: Math.ceil(items.length / limit),
  };
}

export async function fetchPostById(id: number): Promise<Post | null> {
  await delay(200);
  return mockPosts.find((p) => p.id === id) || null;
}

// ── Guides ───────────────────────────────────────────────────────────────────

export async function fetchGuides(): Promise<Guide[]> {
  await delay(200);
  return mockGuides;
}

// ── Notifications ────────────────────────────────────────────────────────────

export async function fetchNotifications(): Promise<Notification[]> {
  await delay(200);
  return mockNotifications;
}
