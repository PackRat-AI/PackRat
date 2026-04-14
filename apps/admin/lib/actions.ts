'use server';

import { revalidatePath } from 'next/cache';
import { deleteCatalogItem, deletePack, deleteUser, updateCatalogItem } from './api';
import type { UpdateCatalogItemInput } from './api';

export async function deleteUserAction(id: number) {
  await deleteUser(id);
  revalidatePath('/dashboard/users');
  revalidatePath('/dashboard');
}

export async function deletePackAction(id: string) {
  await deletePack(id);
  revalidatePath('/dashboard/packs');
  revalidatePath('/dashboard');
}

export async function deleteCatalogItemAction(id: number) {
  await deleteCatalogItem(id);
  revalidatePath('/dashboard/catalog');
  revalidatePath('/dashboard');
}

export async function updateCatalogItemAction(id: number, data: UpdateCatalogItemInput) {
  await updateCatalogItem(id, data);
  revalidatePath('/dashboard/catalog');
}
