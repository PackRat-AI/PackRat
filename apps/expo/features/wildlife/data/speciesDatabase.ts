import type { SpeciesEntry } from '../types';

export const SPECIES_DATABASE: SpeciesEntry[] = [
  // Mammals
  {
    id: 'black-bear',
    commonName: 'American Black Bear',
    scientificName: 'Ursus americanus',
    category: 'mammal',
    description:
      'The American black bear is the most common bear species in North America. Despite the name, they can be black, brown, cinnamon, or even blonde in color.',
    habitat: ['forests', 'mountains', 'swamps'],
    regions: ['north-america'],
    dangerLevel: 'dangerous',
    characteristics: ['large body', 'rounded ears', 'short tail', 'strong claws'],
    conservationStatus: 'Least Concern',
    interestingFacts: [
      'Can run up to 35 mph',
      'Excellent swimmers',
      'Omnivores eating berries, insects, and fish',
    ],
    imageDescription: 'large black or brown bear with rounded ears',
  },
  {
    id: 'white-tailed-deer',
    commonName: 'White-tailed Deer',
    scientificName: 'Odocoileus virginianus',
    category: 'mammal',
    description:
      'The white-tailed deer is the most widely distributed large wild mammal in North America, named for the white underside of its tail.',
    habitat: ['forests', 'meadows', 'farmlands', 'suburban areas'],
    regions: ['north-america'],
    dangerLevel: 'safe',
    characteristics: ['slender legs', 'white tail underside', 'reddish-brown coat in summer'],
    conservationStatus: 'Least Concern',
    interestingFacts: [
      'Males grow antlers annually',
      'Can leap up to 10 feet high',
      'Excellent swimmers',
    ],
    imageDescription: 'slender deer with white tail and large brown eyes',
  },
  {
    id: 'coyote',
    commonName: 'Coyote',
    scientificName: 'Canis latrans',
    category: 'mammal',
    description:
      'The coyote is a canine native to North America. It is highly adaptable and has expanded its range across the continent.',
    habitat: ['prairies', 'deserts', 'forests', 'suburban areas'],
    regions: ['north-america'],
    dangerLevel: 'caution',
    characteristics: ['dog-like appearance', 'bushy tail', 'pointed snout', 'tawny gray coat'],
    conservationStatus: 'Least Concern',
    interestingFacts: [
      'Can run up to 43 mph',
      'Highly vocal - known for howls and yips',
      'Mates for life',
    ],
    imageDescription: 'medium-sized canine with pointed snout and bushy tail',
  },
  {
    id: 'raccoon',
    commonName: 'Raccoon',
    scientificName: 'Procyon lotor',
    category: 'mammal',
    description:
      'The raccoon is a medium-sized mammal native to North America, recognizable by its distinctive black facial mask and ringed tail.',
    habitat: ['forests', 'marshes', 'urban areas'],
    regions: ['north-america'],
    dangerLevel: 'caution',
    characteristics: ['black eye mask', 'ringed tail', 'dexterous front paws', 'gray fur'],
    conservationStatus: 'Least Concern',
    interestingFacts: [
      'Highly intelligent and curious',
      'Can open latches and containers',
      'Wash food before eating',
    ],
    imageDescription: 'medium mammal with black eye mask and striped ringed tail',
  },
  {
    id: 'eastern-gray-squirrel',
    commonName: 'Eastern Gray Squirrel',
    scientificName: 'Sciurus carolinensis',
    category: 'mammal',
    description:
      'A tree squirrel native to eastern North America, known for its large bushy tail and acrobatic abilities.',
    habitat: ['deciduous forests', 'urban parks', 'suburban yards'],
    regions: ['north-america'],
    dangerLevel: 'safe',
    characteristics: ['gray fur', 'bushy tail', 'small rounded ears', 'white belly'],
    conservationStatus: 'Least Concern',
    interestingFacts: [
      'Can locate buried nuts under snow',
      'Can jump up to 20 feet',
      'Plant millions of trees by forgetting buried acorns',
    ],
    imageDescription: 'small gray furry squirrel with large bushy tail',
  },
  // Birds
  {
    id: 'bald-eagle',
    commonName: 'Bald Eagle',
    scientificName: 'Haliaeetus leucocephalus',
    category: 'bird',
    description:
      'The bald eagle is a bird of prey found in North America and the national bird of the United States.',
    habitat: ['near large bodies of open water', 'forests', 'coasts'],
    regions: ['north-america'],
    dangerLevel: 'safe',
    characteristics: ['white head and tail', 'dark brown body', 'large wingspan', 'yellow beak'],
    conservationStatus: 'Least Concern',
    interestingFacts: [
      'Wingspan can reach 8 feet',
      'Can dive at 100 mph',
      'Mates for life',
      'Can live up to 28 years in the wild',
    ],
    imageDescription: 'large bird with distinctive white head and tail, dark brown body',
  },
  {
    id: 'great-horned-owl',
    commonName: 'Great Horned Owl',
    scientificName: 'Bubo virginianus',
    category: 'bird',
    description:
      "One of North America's most common owls, distinguished by its large size and prominent ear tufts that resemble horns.",
    habitat: ['forests', 'deserts', 'swamps', 'suburban areas'],
    regions: ['north-america'],
    dangerLevel: 'safe',
    characteristics: ['large ear tufts', 'yellow eyes', 'mottled brown plumage', 'facial disc'],
    conservationStatus: 'Least Concern',
    interestingFacts: [
      'Can rotate head 270 degrees',
      'Silent flight hunters',
      'One of the first birds to nest in winter',
    ],
    imageDescription: 'large owl with prominent ear tufts and yellow eyes',
  },
  {
    id: 'american-robin',
    commonName: 'American Robin',
    scientificName: 'Turdus migratorius',
    category: 'bird',
    description:
      "The American robin is one of North America's most familiar birds, a true thrush with an orange-red breast.",
    habitat: ['lawns', 'forests', 'parks', 'gardens'],
    regions: ['north-america'],
    dangerLevel: 'safe',
    characteristics: ['orange-red breast', 'dark gray-black back', 'white eye ring', 'yellow bill'],
    conservationStatus: 'Least Concern',
    interestingFacts: [
      'Can eat 14 feet of earthworms per day',
      'First bird heard singing in the morning',
      'Builds neat cup-shaped nests',
    ],
    imageDescription: 'medium bird with distinctive orange-red breast and gray-black back',
  },
  {
    id: 'ruby-throated-hummingbird',
    commonName: 'Ruby-throated Hummingbird',
    scientificName: 'Archilochus colubris',
    category: 'bird',
    description:
      'The only hummingbird species that regularly breeds in eastern North America, known for its iridescent ruby-red throat patch.',
    habitat: ['woodland edges', 'gardens', 'meadows'],
    regions: ['north-america'],
    dangerLevel: 'safe',
    characteristics: [
      'iridescent green back',
      'ruby-red throat (males)',
      'long thin bill',
      'tiny size',
    ],
    conservationStatus: 'Least Concern',
    interestingFacts: [
      'Can flap wings up to 80 times per second',
      'Only bird that can fly backwards',
      'Heart beats over 1,200 times per minute',
    ],
    imageDescription: 'tiny green iridescent bird with needle-thin bill, males have red throat',
  },
  // Plants
  {
    id: 'poison-ivy',
    commonName: 'Poison Ivy',
    scientificName: 'Toxicodendron radicans',
    category: 'plant',
    description:
      'A poisonous plant that causes itching, irritation, and sometimes painful rash in most people who touch it.',
    habitat: ['forests', 'woodlands', 'roadsides', 'stream banks'],
    regions: ['north-america'],
    dangerLevel: 'dangerous',
    characteristics: [
      'groups of three leaflets',
      'glossy green leaves',
      'white or yellow-white berries',
      'can grow as vine or shrub',
    ],
    interestingFacts: [
      '"Leaves of three, let it be" - classic identification rule',
      'Urushiol causes the allergic reaction',
      'Can cause reaction even when dormant in winter',
    ],
    imageDescription: 'plant with distinctive groups of three leaflets, glossy green',
  },
  {
    id: 'wild-blackberry',
    commonName: 'Wild Blackberry',
    scientificName: 'Rubus allegheniensis',
    category: 'plant',
    description:
      'A common thorny shrub that produces edible black berries in summer, found throughout North America.',
    habitat: ['forest edges', 'fields', 'roadsides', 'disturbed areas'],
    regions: ['north-america'],
    dangerLevel: 'safe',
    characteristics: ['thorny canes', 'compound leaves', 'white flowers', 'black berries'],
    interestingFacts: [
      'Rich in antioxidants and vitamins',
      'Important food source for wildlife',
      'Canes are biennial',
    ],
    imageDescription: 'thorny shrub with compound leaves and clusters of black berries',
  },
  {
    id: 'fiddlehead-fern',
    commonName: 'Ostrich Fern (Fiddlehead)',
    scientificName: 'Matteuccia struthiopteris',
    category: 'plant',
    description:
      'A large fern whose tightly coiled young fronds (fiddleheads) are a popular spring edible in North America.',
    habitat: ['moist forests', 'stream banks', 'floodplains'],
    regions: ['north-america'],
    dangerLevel: 'safe',
    characteristics: [
      'vase-shaped growth',
      'coiled spring fronds',
      'brown papery scales',
      'tall bright green fronds',
    ],
    interestingFacts: [
      'Fiddleheads are edible when cooked',
      'Can grow up to 5 feet tall',
      'Spreads through underground rhizomes',
    ],
    imageDescription: 'large fern with vase-shaped cluster and tightly coiled new fronds',
  },
  {
    id: 'trillium',
    commonName: 'White Trillium',
    scientificName: 'Trillium grandiflorum',
    category: 'flower',
    description:
      'A spring wildflower with three broad leaves and a single three-petaled white flower. The provincial flower of Ontario, Canada.',
    habitat: ['deciduous forests', 'shaded slopes', 'rich woodlands'],
    regions: ['north-america'],
    dangerLevel: 'safe',
    characteristics: [
      'three broad leaves',
      'three white petals',
      'single flower per stem',
      'turns pink with age',
    ],
    interestingFacts: [
      'Takes 7+ years to bloom from seed',
      'Protected in many states',
      'Spreads by ants carrying seeds',
    ],
    imageDescription: 'white three-petaled flower above three broad leaves',
  },
  {
    id: 'wild-violet',
    commonName: 'Common Blue Violet',
    scientificName: 'Viola sororia',
    category: 'flower',
    description:
      'A low-growing wildflower with heart-shaped leaves and distinctive blue-violet flowers common in lawns and woodlands.',
    habitat: ['lawns', 'woodlands', 'stream banks', 'meadows'],
    regions: ['north-america'],
    dangerLevel: 'safe',
    characteristics: ['heart-shaped leaves', 'blue-violet flowers', 'five petals', 'low growing'],
    interestingFacts: [
      'Edible flowers and leaves',
      'High in vitamins A and C',
      'Self-pollinates via underground flowers',
    ],
    imageDescription: 'small blue-purple five-petaled flower with heart-shaped leaves',
  },
  // Trees
  {
    id: 'sugar-maple',
    commonName: 'Sugar Maple',
    scientificName: 'Acer saccharum',
    category: 'tree',
    description:
      'The sugar maple is a large deciduous tree famous for its brilliant fall colors and as the source of maple syrup.',
    habitat: ['deciduous forests', 'mountain slopes', 'rich upland soils'],
    regions: ['north-america'],
    dangerLevel: 'safe',
    characteristics: [
      'five-lobed leaves',
      'opposite leaf arrangement',
      'winged samara seeds',
      'gray-brown furrowed bark',
    ],
    interestingFacts: [
      'National tree of Canada',
      'Takes 40 years to produce syrup in quantity',
      'Fall leaves turn brilliant orange, red, and yellow',
    ],
    imageDescription: 'large tree with distinctive five-lobed maple leaves and paired winged seeds',
  },
  {
    id: 'eastern-white-pine',
    commonName: 'Eastern White Pine',
    scientificName: 'Pinus strobus',
    category: 'tree',
    description:
      'The largest pine in eastern North America, recognized by its soft blue-green needles in bundles of five.',
    habitat: ['mixed forests', 'rocky hillsides', 'sandy soils'],
    regions: ['north-america'],
    dangerLevel: 'safe',
    characteristics: [
      'needles in bundles of five',
      'soft flexible needles',
      'long cylindrical cones',
      'straight tall trunk',
    ],
    interestingFacts: [
      'Can grow over 200 feet tall',
      'State tree of Maine and Michigan',
      'Needles high in vitamin C',
    ],
    imageDescription: 'tall pine tree with soft blue-green needles in bundles of five',
  },
  // Reptiles
  {
    id: 'eastern-garter-snake',
    commonName: 'Eastern Garter Snake',
    scientificName: 'Thamnophis sirtalis sirtalis',
    category: 'reptile',
    description:
      'One of the most common snakes in North America, recognizable by stripes along its body. Non-venomous and beneficial to gardens.',
    habitat: ['meadows', 'marshes', 'woods', 'hillsides', 'suburban gardens'],
    regions: ['north-america'],
    dangerLevel: 'safe',
    characteristics: [
      'three light stripes on dark body',
      'slender body',
      'keeled scales',
      'medium size',
    ],
    conservationStatus: 'Least Concern',
    interestingFacts: [
      'Non-venomous but may release musk when threatened',
      'Eats earthworms, frogs, and small rodents',
      'Can survive light frost',
    ],
    imageDescription: 'slender snake with three distinct yellow or green stripes on dark body',
  },
  {
    id: 'painted-turtle',
    commonName: 'Painted Turtle',
    scientificName: 'Chrysemys picta',
    category: 'reptile',
    description:
      'The most widespread native turtle in North America, recognized by the colorful yellow and red markings on its shell and skin.',
    habitat: ['ponds', 'lakes', 'slow-moving streams', 'marshes'],
    regions: ['north-america'],
    dangerLevel: 'safe',
    characteristics: [
      'dark oval shell',
      'red and yellow markings on margins',
      'yellow striped head',
      'flat bottom shell',
    ],
    conservationStatus: 'Least Concern',
    interestingFacts: [
      'Can survive being frozen solid in winter',
      'Bask in groups on logs',
      'Live up to 55 years',
    ],
    imageDescription:
      'small turtle with dark oval shell and colorful red-yellow markings along edges',
  },
  // Insects
  {
    id: 'monarch-butterfly',
    commonName: 'Monarch Butterfly',
    scientificName: 'Danaus plexippus',
    category: 'insect',
    description:
      'The most recognized butterfly in North America, known for its striking orange and black pattern and remarkable annual migration.',
    habitat: ['meadows', 'fields', 'gardens', 'roadsides'],
    regions: ['north-america'],
    dangerLevel: 'safe',
    characteristics: [
      'bright orange wings',
      'black veins and borders',
      'white spots on margins',
      'large wingspan',
    ],
    conservationStatus: 'Endangered',
    interestingFacts: [
      'Migrates up to 3,000 miles to Mexico',
      'Toxic to predators due to milkweed diet',
      'Uses magnetic field for navigation',
    ],
    imageDescription:
      'large butterfly with bright orange wings, black veins, and white-spotted borders',
  },
  {
    id: 'firefly',
    commonName: 'Common Eastern Firefly',
    scientificName: 'Photinus pyralis',
    category: 'insect',
    description:
      'The most common firefly in eastern North America, known for its yellow-green bioluminescent flash used to attract mates.',
    habitat: ['meadows', 'forest edges', 'yards', 'near water'],
    regions: ['north-america'],
    dangerLevel: 'safe',
    characteristics: [
      'soft yellowish-green light',
      'black and yellow/red thorax',
      'small size',
      'soft wing covers',
    ],
    interestingFacts: [
      'Light produced with nearly 100% efficiency',
      'Flash pattern is species-specific',
      'Larvae are predators in soil',
    ],
    imageDescription: 'small beetle with yellow-green glowing abdomen visible at dusk',
  },
  // Mushrooms
  {
    id: 'chanterelle',
    commonName: 'Golden Chanterelle',
    scientificName: 'Cantharellus cibarius',
    category: 'mushroom',
    description:
      'A prized edible mushroom with a distinctive golden-yellow color and funnel-shaped cap with forked ridges rather than true gills.',
    habitat: ['hardwood forests', 'mixed forests', 'near oak and beech trees'],
    regions: ['north-america', 'europe'],
    dangerLevel: 'safe',
    characteristics: [
      'golden yellow color',
      'funnel or vase shape',
      'forked false gills (ridges)',
      'fruity apricot smell',
    ],
    interestingFacts: [
      'One of the most prized edible mushrooms',
      'Cannot be commercially cultivated',
      'Look-alike jack-o-lantern mushroom is toxic',
    ],
    imageDescription: 'golden yellow funnel-shaped mushroom with forked ridges instead of gills',
  },
  {
    id: 'death-cap',
    commonName: 'Death Cap',
    scientificName: 'Amanita phalloides',
    category: 'mushroom',
    description:
      'One of the most deadly mushrooms in the world, responsible for most fatal mushroom poisonings. Pale green to yellowish cap.',
    habitat: ['woodland edges', 'near oak, chestnut, and pine trees'],
    regions: ['north-america', 'europe', 'asia'],
    dangerLevel: 'dangerous',
    characteristics: [
      'pale green or yellowish cap',
      'white gills',
      'ring on stem',
      'bulbous base (volva)',
      'white spores',
    ],
    interestingFacts: [
      'Contains amatoxins that destroy liver and kidneys',
      'Symptoms delayed 6-24 hours - often too late',
      'Responsible for 90% of fatal mushroom poisonings',
    ],
    imageDescription:
      'pale green or yellowish cap with white gills, ring on stem, and bulbous base',
  },
];

export function getSpeciesByCategory(category: string): SpeciesEntry[] {
  return SPECIES_DATABASE.filter((s) => s.category === category);
}

export function getSpeciesById(id: string): SpeciesEntry | undefined {
  return SPECIES_DATABASE.find((s) => s.id === id);
}

export function searchSpecies(query: string): SpeciesEntry[] {
  const lower = query.toLowerCase();
  return SPECIES_DATABASE.filter(
    (s) =>
      s.commonName.toLowerCase().includes(lower) ||
      s.scientificName.toLowerCase().includes(lower) ||
      s.description.toLowerCase().includes(lower) ||
      s.characteristics.some((c) => c.toLowerCase().includes(lower)),
  );
}
