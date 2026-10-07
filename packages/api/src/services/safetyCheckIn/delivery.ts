import { sendEmail } from '@packrat/api/utils/email';
import { getEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
import { renderSafetyEmail } from './emailTemplate';
import type { SafetyMessage } from './messages';

export interface ContactAddress {
  name: string;
  phone: string | null;
  email: string | null;
}

export interface DeliveryResult {
  sms: 'sent' | 'skipped' | 'failed';
  email: 'sent' | 'skipped' | 'failed';
}

/** The plain-text part: the message, then why they're receiving it. */
export function renderEmailText(message: SafetyMessage): string {
  return (
    `${message.text}\n\n` +
    "You're receiving this because someone added you as their emergency contact in PackRat."
  );
}

async function sendSms({ to, body }: { to: string; body: string }): Promise<'sent' | 'skipped'> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = getEnv();
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.warn('[safetyCheckIn] Twilio is not configured; SMS skipped');
    return 'skipped';
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: body }).toString(),
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw Object.assign(new Error(`Twilio send failed: ${response.status} ${detail}`), {
      httpStatus: response.status,
    });
  }
  return 'sent';
}

/**
 * Sends a message to one contact on every channel they have. A failure on one
 * channel is captured and doesn't stop the other, and never throws: one
 * unreachable contact must not keep the rest from hearing about an overdue
 * user.
 */
export async function deliverToContact({
  contact,
  message,
  operation,
  checkInId,
}: {
  contact: ContactAddress;
  message: SafetyMessage;
  operation: string;
  checkInId?: string;
}): Promise<DeliveryResult> {
  const result: DeliveryResult = { sms: 'skipped', email: 'skipped' };

  if (contact.phone) {
    try {
      result.sms = await sendSms({ to: contact.phone, body: message.text });
    } catch (error) {
      result.sms = 'failed';
      captureApiException({
        error,
        operation: `safetyCheckIn.${operation}.sms`,
        tags: { feature: 'safetyCheckIn' },
        extra: { checkInId },
      });
    }
  }

  if (contact.email) {
    try {
      await sendEmail({
        to: contact.email,
        subject: message.subject,
        html: renderSafetyEmail(message),
        text: renderEmailText(message),
      });
      result.email = 'sent';
    } catch (error) {
      result.email = 'failed';
      captureApiException({
        error,
        operation: `safetyCheckIn.${operation}.email`,
        tags: { feature: 'safetyCheckIn' },
        extra: { checkInId },
      });
    }
  }

  return result;
}

export async function deliverToContacts({
  contacts,
  message,
  operation,
  checkInId,
}: {
  contacts: ContactAddress[];
  message: SafetyMessage;
  operation: string;
  checkInId?: string;
}): Promise<DeliveryResult[]> {
  return Promise.all(
    contacts.map((contact) => deliverToContact({ contact, message, operation, checkInId })),
  );
}
