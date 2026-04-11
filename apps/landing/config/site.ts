import type {
  FaqItem,
  Feature,
  Integration,
  NavItem,
  SocialLink,
  Step,
  Testimonial,
} from 'landing-app/types/site';

export const siteConfig = {
  name: 'PackRat',
  description:
    'Your ultimate outdoor adventure companion. Plan, pack, and explore with confidence.',
  url: 'https://getpackrat.com',
  ogImage: '/og-image.jpg',
  author: 'PackRat Team',
  twitterHandle: '@packratai',
  keywords: [
    'outdoor',
    'adventure',
    'hiking',
    'camping',
    'backpacking',
    'trail maps',
    'packing list',
    'hiking app',
    'outdoor planning',
  ],

  // Color scheme
  colors: {
    primary: '#0F766E', // Teal
    primaryLight: '#14B8A6', // Light teal
    primaryDark: '#0D9488', // Dark teal
    secondary: '#F97316', // Orange
    secondaryLight: '#FB923C', // Light orange
    secondaryDark: '#EA580C', // Dark orange
    tertiary: '#8B5CF6', // Purple
    tertiaryLight: '#A78BFA', // Light purple
    dark: '#1E293B', // Slate 800
    darkAlt: '#0F172A', // Slate 900
    light: '#F8FAFC', // Slate 50
    lightAlt: '#F1F5F9', // Slate 100
    textPrimary: '#0F172A', // Slate 900
    textSecondary: '#475569', // Slate 600
    textTertiary: '#94A3B8', // Slate 400
    gradientPrimary: 'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)',
    gradientSecondary: 'linear-gradient(135deg, #F97316 0%, #FB923C 100%)',
    gradientTertiary: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
    gradientDark: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
    gradientMesh:
      'radial-gradient(at 67% 33%, hsla(162, 77%, 40%, 0.15) 0px, transparent 50%), radial-gradient(at 33% 67%, hsla(23, 100%, 50%, 0.15) 0px, transparent 50%), radial-gradient(at 80% 80%, hsla(242, 100%, 70%, 0.15) 0px, transparent 50%), radial-gradient(at 0% 0%, hsla(343, 100%, 76%, 0.15) 0px, transparent 50%)',
  },

  // Navigation
  mainNav: [
    {
      title: 'Features',
      href: '#features',
    },
    {
      title: 'Guides',
      href: 'https://guides.packratai.com/',
    },
    {
      title: 'How It Works',
      href: '#how-it-works',
    },
    {
      title: 'Integrations',
      href: '#integrations',
    },
    {
      title: 'Testimonials',
      href: '#testimonials',
    },
    {
      title: 'FAQ',
      href: '#faq',
    },
  ] as NavItem[],

  // CTAs
  cta: {
    primary: {
      text: 'Download Free',
      href: '#download',
    },
    secondary: {
      text: 'See How It Works',
      href: '#how-it-works',
    },
    tertiary: {
      text: 'Explore Guides',
      href: 'https://guides.packratai.com/',
    },
  },

  // Hero section
  hero: {
    badge: '100% Free · AI-Powered Packing Lists',
    title: 'Stop overpacking. Start adventuring.',
    subtitle:
      "PackRat's AI builds your perfect packing list based on your trip, the weather, and your gear — so you carry exactly what you need and nothing you don't.",
    image: '/hero-app-preview.png',
    socialProof: 'Trusted by 10,000+ outdoor enthusiasts · 4.8★ rating · Works offline',
    stats: [
      {
        value: '10K+',
        label: 'Active Users',
      },
      {
        value: '4.8★',
        label: 'App Rating',
      },
      {
        value: '100%',
        label: 'Free Forever',
      },
    ],
  },

  // Features section
  features: [
    {
      id: 'packing-lists',
      title: 'Smart Packing Lists',
      description:
        "Never forget essential gear — or carry stuff you don't need. PackRat's AI tailors your list to your exact trip.",
      icon: 'CheckSquare',
      color: '#0F766E',
      image: '/feature-packing-list.png',
    },
    {
      id: 'trail-maps',
      title: 'Trail Maps & Navigation',
      description:
        'Find your trail and navigate it offline. Download maps before you go and stay on track even with no signal.',
      icon: 'Map',
      color: '#F97316',
      image: '/feature-trail-maps.png',
    },
    {
      id: 'guides',
      title: 'Guides',
      description:
        'Browse practical guides on trip planning, gear selection, and survival strategies for every adventure.',
      icon: 'Book',
      color: '#14B8A6',
      image: '/feature-guides-ios.png',
    },
    {
      id: 'trip-planning',
      title: 'Trip Planning',
      description:
        'Plan your perfect route from start to finish — set waypoints, estimate hiking times, and share with your group.',
      icon: 'Compass',
      color: '#8B5CF6',
      image: '/feature-trip-planning.png',
    },
    {
      id: 'recommendations',
      title: 'Trail Recommendations',
      description:
        'Discover trails matched to your fitness level and experience — no more guessing if a trail is right for you.',
      icon: 'Mountain',
      color: '#EC4899',
      image: '/feature-recommendations.png',
    },
    {
      id: 'weather',
      title: 'Weather Integration',
      description:
        "Pack for the weather you'll actually get. Real-time forecasts for your exact route and dates.",
      icon: 'Cloud',
      color: '#3B82F6',
      image: '/feature-weather.png',
    },
    {
      id: 'offline',
      title: 'Offline Access',
      description:
        'Your packing lists, maps, and trip details are always available — even deep in the backcountry without signal.',
      icon: 'Download',
      color: '#10B981',
      image: '/feature-offline.png',
    },
  ] as [Feature, Feature, ...Feature[]],

  // How it works section
  howItWorks: {
    title: 'How PackRat Works',
    subtitle:
      'Getting started is simple. Download the app and be ready for your next adventure in minutes.',
    steps: [
      {
        number: 1,
        title: 'Download the App',
        description: 'Get PackRat from the App Store or Google Play Store and create your account.',
        image: '/step-download.png',
      },
      {
        number: 2,
        title: 'Plan Your Trip',
        description: 'Create a new trip, select your destination, and set your adventure dates.',
        image: '/step-plan.png',
      },
      {
        number: 3,
        title: 'Pack & Explore',
        description: 'Use your customized packing list and hit the trails with confidence.',
        image: '/step-explore.png',
      },
    ] as Step[],
  },

  // Integrations section
  integrations: {
    title: 'Connects With the Tools You Already Use',
    subtitle:
      'PackRat works with your favorite outdoor and weather services so everything is in one place.',
    items: [
      {
        id: 'weather',
        name: 'Weather Services',
        description: 'Real-time weather data from multiple providers',
        icon: 'Cloud',
        color: '#3B82F6',
        features: ['Real-time Data', 'Hourly Forecasts', 'Weather Alerts'],
      },
      {
        id: 'maps',
        name: 'Trail Databases',
        description: 'Access thousands of trails and routes',
        icon: 'Map',
        color: '#F97316',
        features: ['10,000+ Trails', 'Difficulty Ratings', 'User Reviews'],
      },
      {
        id: 'health',
        name: 'Health Apps',
        description: 'Sync with Apple Health and Google Fit',
        icon: 'Heart',
        color: '#EC4899',
        features: ['Step Tracking', 'Heart Rate', 'Fitness Stats'],
      },
      {
        id: 'calendar',
        name: 'Calendar',
        description: 'Sync trips with your calendar',
        icon: 'Calendar',
        color: '#8B5CF6',
        features: ['Trip Sync', 'Reminders', 'Shared Calendars'],
      },
      {
        id: 'sharing',
        name: 'Social Sharing',
        description: 'Share trips and routes with friends',
        icon: 'Share2',
        color: '#10B981',
        features: ['Share Routes', 'Group Trips', 'Community'],
      },
      {
        id: 'emergency',
        name: 'Emergency Services',
        description: 'Quick access to emergency contacts',
        icon: 'AlertTriangle',
        color: '#EF4444',
        features: ['SOS Alerts', 'Contact Sharing', 'GPS Location'],
      },
    ] as Integration[],
  },

  // Testimonials section
  testimonials: {
    title: 'What Adventurers Are Saying',
    subtitle: 'Join thousands of outdoor enthusiasts who trust PackRat for their adventures.',
    items: [
      {
        id: 1,
        name: 'Mike Thompson',
        role: 'Backpacker',
        content:
          'PackRat has completely changed how I prepare for hikes. I used to always forget something important, but not anymore! The AI packing list is spot-on every single time.',
        initials: 'MT',
        avatar: '/avatar-mike.jpg',
        rating: 5,
      },
      {
        id: 2,
        name: 'Sarah Linden',
        role: 'Thru-Hiker · PCT 2024',
        content:
          "I used PackRat for my entire PCT thru-hike. The offline maps saved me multiple times in remote sections with zero signal. Absolutely essential gear — and it's free!",
        initials: 'SL',
        avatar: '/avatar-sarah.jpg',
        rating: 5,
      },
      {
        id: 3,
        name: 'James Rodriguez',
        role: 'Weekend Camper',
        content:
          'As someone who camps with the family a few times a year, the smart packing lists are perfect. No more frantic last-minute checks — PackRat has everything covered.',
        initials: 'JR',
        avatar: '/avatar-james.jpg',
        rating: 5,
      },
      {
        id: 4,
        name: 'Emily Chen',
        role: 'Hiking Guide',
        content:
          'I use PackRat to plan trips for my guided hiking groups. Sharing packing lists with clients beforehand has made my job so much easier. Highly recommend for professionals!',
        initials: 'EC',
        avatar: '/avatar-emily.jpg',
        rating: 5,
      },
    ] as Testimonial[],
  },

  // Download section
  download: {
    title: 'Ready for your next adventure?',
    subtitle: 'Download PackRat today and start planning your outdoor journeys with confidence.',
    appStoreLink: 'https://apps.apple.com/us/app/packrat-ai/id6499243187',
    googlePlayLink: 'https://play.google.com/store/apps/details?id=com.packratai.mobile&pli=1',
    image: '/download-now-ios-image.png',
    features: [
      'Free — no hidden fees',
      'Works offline',
      'AI-powered packing lists',
      'Regular updates',
    ],
  },

  // FAQ section
  faqs: [
    {
      question: 'Is PackRat free to use?',
      answer:
        'Yes — PackRat is completely free. No subscriptions, no in-app purchases, no ads. We are focused on growing our community of outdoor enthusiasts.',
    },
    {
      question: 'Does PackRat work offline?',
      answer:
        "Yes! Once you've downloaded your trip information, you can access your packing lists, maps, and routes without an internet connection.",
    },
    {
      question: 'Which devices is PackRat available on?',
      answer: 'PackRat is available for iOS and Android devices. A web version is coming soon!',
    },
    {
      question: 'How accurate are the trail maps?',
      answer:
        'Our maps are regularly updated and include data from trusted sources like USGS, OpenStreetMap, and user contributions. However, we always recommend carrying a physical map as backup.',
    },
    {
      question: 'Can I share my trips with friends?',
      answer:
        'Yes! PackRat makes it easy to share your planned routes, packing lists, and trip details with friends and family.',
    },
    {
      question: 'How does the weather integration work?',
      answer:
        'PackRat connects to multiple weather services to provide accurate forecasts for your specific trail and time period. The app will alert you to any significant weather changes before and during your trip.',
    },
  ] as FaqItem[],

  // Footer links
  footerLinks: {
    product: [
      { title: 'Features', href: '#features' },
      { title: 'Pricing', href: '/pricing' },
      { title: 'Guides', href: 'https://guides.packratai.com/' },
      { title: 'Integrations', href: '#integrations' },
    ],
    company: [
      { title: 'About', href: '/about' },
      { title: 'Blog', href: '/blog' },
      { title: 'Careers', href: '/about#careers' },
      { title: 'Contact', href: 'mailto:hello@packratai.com' },
    ],
    legal: [
      { title: 'Terms', href: '#' },
      { title: 'Privacy', href: '/privacy-policy' },
      { title: 'Cookies', href: '#' },
      { title: 'Licenses', href: '#' },
    ],
  },

  // Social links
  social: [
    {
      name: 'Twitter',
      href: 'https://x.com/packratai',
      icon: 'Twitter',
    },
    {
      name: 'Instagram',
      href: 'https://www.instagram.com/packratai',
      icon: 'Instagram',
    },
    {
      name: 'Facebook',
      href: 'https://www.facebook.com/packratai',
      icon: 'Facebook',
    },
  ] as SocialLink[],
};
