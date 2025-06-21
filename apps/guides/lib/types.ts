export interface Post {
  slug: string;
  title: string;
  description: string;
  date: string;
  categories?: string[];
  author?: string;
  readingTime?: string;
  difficulty?: string;
  coverImage?: string;
  content?: string;
}
