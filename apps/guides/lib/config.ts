import { Compass, type LucideIcon, Map as MapIcon, MountainSnow } from 'lucide-react';

// Site metadata
export const siteConfig = {
  name: 'PackRat Guides',
  description: 'Expert hiking and outdoor guides to help you prepare for your next adventure',
  url: 'https://packrat-guides.com',
  ogImage: 'https://packrat-guides.com/og.jpg',
  links: {
    twitter: 'https://twitter.com/packratguides',
    github: 'https://github.com/packratguides',
    instagram: 'https://instagram.com/packratguides',
    facebook: 'https://facebook.com/packratguides',
  },
};

// Navigation configuration
export const navigationConfig = {
  mainNav: [
    {
      title: 'Home',
      href: '/',
    },
    {
      title: 'Gear',
      href: '/?category=gear',
    },
    {
      title: 'Skills',
      href: '/?category=skills',
    },
    {
      title: 'Safety',
      href: '/?category=safety',
    },
  ],
  // Maximum number of categories to show in header
  maxCategories: 4,
};

// Feature section configuration
export interface FeatureItem {
  title: string;
  description: string;
  icon: LucideIcon;
  iconBgClass: string;
  iconClass: string;
}

export const featuresConfig: FeatureItem[] = [
  {
    title: 'Trail Guides',
    description: 'Detailed information on the best hiking trails around the world',
    icon: MountainSnow,
    iconBgClass: 'bg-blue-100 dark:bg-blue-900/20',
    iconClass: 'text-apple-blue dark:text-blue-400',
  },
  {
    title: 'Gear Reviews',
    description: 'Expert reviews and recommendations for outdoor equipment',
    icon: Compass,
    iconBgClass: 'bg-blue-100 dark:bg-blue-900/20',
    iconClass: 'text-apple-blue dark:text-blue-400',
  },
  {
    title: 'Survival Skills',
    description: 'Essential wilderness skills and safety information',
    icon: MapIcon,
    iconBgClass: 'bg-blue-100 dark:bg-blue-900/20',
    iconClass: 'text-apple-blue dark:text-blue-400',
  },
];

// Footer configuration
export const footerConfig = {
  mainSections: [
    {
      title: 'Guides',
      links: [], // This will be populated dynamically with categories
    },
    {
      title: 'Company',
      links: [
        { title: 'About Us', href: '#' },
        { title: 'Contact', href: '#' },
        { title: 'Privacy Policy', href: '#' },
        { title: 'Terms of Service', href: '#' },
      ],
    },
  ],
};

// Theme configuration
export const themeConfig = {
  defaultTheme: 'system',
  lightColors: {
    primary: '#007AFF', // iOS blue
    background: '#FFFFFF',
    card: '#FFFFFF',
    text: '#1D1D1F',
    muted: '#86868B',
    border: '#E5E5EA',
  },
  darkColors: {
    primary: '#0A84FF', // iOS blue (dark mode)
    background: '#1D1D1F',
    card: '#2C2C2E',
    text: '#F5F5F7',
    muted: '#86868B',
    border: '#38383A',
  },
};
