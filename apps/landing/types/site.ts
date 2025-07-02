export interface NavItem {
  title: string;
  href: string;
  disabled?: boolean;
}

export interface Feature {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  image?: string;
}

export interface Step {
  number: number;
  title: string;
  description: string;
  image?: string;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface Testimonial {
  id: number;
  name: string;
  role: string;
  content: string;
  initials: string;
  avatar?: string;
  rating: number;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface SocialLink {
  name: string;
  href: string;
  icon: string;
}
