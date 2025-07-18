export interface Guide {
  id: string;
  key: string;
  title: string;
  category: string;
  categories?: string[];
  description: string;
  content?: string;
  author?: string;
  readingTime?: string;
  difficulty?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GuidesListResponse {
  items: Guide[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface GuidesSearchResponse extends GuidesListResponse {
  query: string;
}
