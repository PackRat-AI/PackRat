import { createDb } from '@packrat/api/db';
import { emergencyContacts } from '@packrat/db/schema';
import type {
  CreateEmergencyContactRequest,
  EmergencyContact,
  UpdateEmergencyContactRequest,
} from '@packrat/schemas/safetyCheckIn';
import { and, asc, eq, ne } from 'drizzle-orm';

const contactColumns = Object.freeze({
  id: emergencyContacts.id,
  name: emergencyContacts.name,
  phone: emergencyContacts.phone,
  email: emergencyContacts.email,
  isDefault: emergencyContacts.isDefault,
  createdAt: emergencyContacts.createdAt,
  updatedAt: emergencyContacts.updatedAt,
} as const);

type ContactRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function toEmergencyContactResponse(row: ContactRow): EmergencyContact {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const ownedLive = (userId: string) =>
  and(eq(emergencyContacts.userId, userId), eq(emergencyContacts.deleted, false));

export async function listEmergencyContacts(userId: string): Promise<ContactRow[]> {
  const db = createDb();
  return db
    .tag('safetyCheckIn.listContacts')
    .select(contactColumns)
    .from(emergencyContacts)
    .where(ownedLive(userId))
    .orderBy(asc(emergencyContacts.createdAt));
}

/** Only one contact is the default; setting one clears the rest. */
async function clearOtherDefaults(userId: string, keepId: string) {
  const db = createDb();
  await db
    .tag('safetyCheckIn.clearDefaultContacts')
    .update(emergencyContacts)
    .set({ isDefault: false, updatedAt: new Date() })
    .where(and(ownedLive(userId), ne(emergencyContacts.id, keepId)));
}

export async function createEmergencyContact({
  userId,
  request,
}: {
  userId: string;
  request: CreateEmergencyContactRequest;
}): Promise<ContactRow> {
  const db = createDb();
  const existing = await listEmergencyContacts(userId);
  // The first contact a user adds is their default unless they say otherwise.
  const isDefault = request.isDefault ?? existing.length === 0;

  const [row] = await db
    .tag('safetyCheckIn.createContact')
    .insert(emergencyContacts)
    .values({
      id: request.id,
      userId,
      name: request.name,
      phone: request.phone ?? null,
      email: request.email ?? null,
      isDefault,
    })
    // A retried create from the offline outbox returns the stored row.
    .onConflictDoNothing({ target: emergencyContacts.id })
    .returning();

  const stored =
    row ??
    (
      await db
        .tag('safetyCheckIn.getContact')
        .select(contactColumns)
        .from(emergencyContacts)
        .where(and(eq(emergencyContacts.id, request.id), ownedLive(userId)))
    )[0];
  if (!stored) throw new Error('Emergency contact id is already in use');

  if (row && isDefault) await clearOtherDefaults(userId, row.id);
  return stored;
}

export async function updateEmergencyContact({
  userId,
  contactId,
  request,
}: {
  userId: string;
  contactId: string;
  request: UpdateEmergencyContactRequest;
}): Promise<ContactRow | null> {
  const db = createDb();
  const update: Partial<typeof emergencyContacts.$inferInsert> = { updatedAt: new Date() };
  if (request.name !== undefined) update.name = request.name;
  if (request.phone !== undefined) update.phone = request.phone;
  if (request.email !== undefined) update.email = request.email;
  if (request.isDefault !== undefined) update.isDefault = request.isDefault;

  const current = (
    await db
      .tag('safetyCheckIn.getContact')
      .select(contactColumns)
      .from(emergencyContacts)
      .where(and(eq(emergencyContacts.id, contactId), ownedLive(userId)))
  )[0];
  if (!current) return null;

  const phone = update.phone !== undefined ? update.phone : current.phone;
  const email = update.email !== undefined ? update.email : current.email;
  if (!phone && !email) throw new ContactValidationError();

  const [row] = await db
    .tag('safetyCheckIn.updateContact')
    .update(emergencyContacts)
    .set(update)
    .where(and(eq(emergencyContacts.id, contactId), ownedLive(userId)))
    .returning();
  if (!row) return null;

  if (request.isDefault) await clearOtherDefaults(userId, contactId);
  return row;
}

export async function deleteEmergencyContact({
  userId,
  contactId,
}: {
  userId: string;
  contactId: string;
}): Promise<boolean> {
  const db = createDb();
  const [row] = await db
    .tag('safetyCheckIn.deleteContact')
    .update(emergencyContacts)
    .set({ deleted: true, isDefault: false, updatedAt: new Date() })
    .where(and(eq(emergencyContacts.id, contactId), ownedLive(userId)))
    .returning();
  return Boolean(row);
}

export class ContactValidationError extends Error {
  constructor() {
    super('A contact needs a phone number or an email address');
    this.name = 'ContactValidationError';
  }
}
