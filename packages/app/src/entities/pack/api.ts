import type { ApiClient } from '../../shared/api';

export const getPacks = (client: ApiClient) => client.packs.get({ query: { includePublic: 0 } });

export const getPack = (client: ApiClient, packId: string) => client.packs({ packId }).get();

export const createPack = (
  client: ApiClient,
  body: {
    id: string;
    name: string;
    description?: string;
    category?: string;
    isPublic: boolean;
    image?: string | null;
    tags?: string[];
    localCreatedAt: string;
    localUpdatedAt: string;
  },
) => client.packs.post(body);

export const updatePack = (
  client: ApiClient,
  {
    packId,
    body,
  }: {
    packId: string;
    body: {
      name?: string;
      description?: string;
      category?: string;
      isPublic?: boolean;
      image?: string | null;
      tags?: string[];
      deleted?: boolean;
      localUpdatedAt?: string;
    };
  },
) => client.packs({ packId }).put(body);

export const deletePack = (client: ApiClient, packId: string) => client.packs({ packId }).delete();

export const addPackItem = (
  client: ApiClient,
  {
    packId,
    body,
  }: {
    packId: string;
    body: {
      id: string;
      name: string;
      description?: string;
      weight: number;
      weightUnit: 'g' | 'oz' | 'kg' | 'lb';
      quantity: number;
      consumable: boolean;
      worn: boolean;
      category?: string;
      image?: string | null;
      notes?: string | null;
      catalogItemId?: number | null;
    };
  },
) => client.packs({ packId }).items.post(body);

export const updatePackItem = (
  client: ApiClient,
  {
    itemId,
    body,
  }: {
    itemId: string;
    body: {
      name?: string;
      description?: string;
      weight?: number;
      weightUnit?: 'g' | 'oz' | 'kg' | 'lb';
      quantity?: number;
      category?: string;
      consumable?: boolean;
      worn?: boolean;
      image?: string | null;
      notes?: string | null;
      catalogItemId?: number | null;
      deleted?: boolean;
    };
  },
) => client.packs.items({ itemId }).patch(body);

export const deletePackItem = (client: ApiClient, itemId: string) =>
  client.packs.items({ itemId }).delete();
