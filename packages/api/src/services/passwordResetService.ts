import { hashPassword } from '@better-auth/utils/password';
import { createDb } from '@packrat/api/db';
import { timingSafeEqual } from '@packrat/api/utils/auth';
import { sendPasswordResetEmail } from '@packrat/api/utils/email';
import { account, users, verification } from '@packrat/db';
import { and, eq, gt } from 'drizzle-orm';

const OTP_LENGTH = 6;
const OTP_TTL_MS = 15 * 60 * 1000; // 15 minutes
const IDENTIFIER_PREFIX = 'password-reset:';

function generateOtp(): string {
  return Array.from({ length: OTP_LENGTH }, () => Math.floor(Math.random() * 10)).join('');
}

export async function requestPasswordReset(email: string): Promise<void> {
  const db = createDb();

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) return; // Don't reveal whether the email is registered

  const code = generateOtp();
  const identifier = `${IDENTIFIER_PREFIX}${email}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

  await db.delete(verification).where(eq(verification.identifier, identifier));
  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier,
    value: code,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  await sendPasswordResetEmail({ to: email, code });
}

export async function verifyOtpAndResetPassword({
  email,
  code,
  newPassword,
}: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<void> {
  const db = createDb();
  const identifier = `${IDENTIFIER_PREFIX}${email}`;

  const record = await db.query.verification.findFirst({
    where: and(eq(verification.identifier, identifier), gt(verification.expiresAt, new Date())),
  });

  if (!record || !timingSafeEqual(record.value, code)) {
    throw new Error('Invalid or expired reset code');
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) throw new Error('User not found');

  const hashedPassword = await hashPassword(newPassword);
  const now = new Date();

  // Update the credential account record (Better Auth email/password users)
  const updated = await db
    .update(account)
    .set({ password: hashedPassword, updatedAt: now })
    .where(and(eq(account.userId, user.id), eq(account.providerId, 'credential')))
    .returning();

  // Fallback for legacy users whose password lives on the users row
  if (updated.length === 0) {
    await db
      .update(users)
      .set({ passwordHash: hashedPassword, updatedAt: now })
      .where(eq(users.id, user.id));
  }

  await db.delete(verification).where(eq(verification.identifier, identifier));
}
