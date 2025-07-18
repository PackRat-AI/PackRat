export interface Guide {
  id: string;
  key: string;
  title: string;
  category: string;
  description: string;
  content?: string;
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
