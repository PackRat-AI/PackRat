import { sendEmail } from '@packrat/api/utils/email';
import { getEnv } from '@packrat/api/utils/env-validation';
import { captureApiException } from '@packrat/api/utils/sentry';
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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Email body: the SMS text with its link made clickable. */
export function renderEmailHtml(message: SafetyMessage): string {
  const linked = escapeHtml(message.text).replace(
    /(https?:\/\/[^\s<]+[^\s<.,)])/g,
    '<a href="$1">$1</a>',
  );
  return (
    '<div style="font-family: -apple-system, Arial, sans-serif; max-width: 560px; margin: 0 auto; ' +
    'font-size: 16px; line-height: 1.5; color: #1a1a1a;">' +
    `<p>${linked}</p>` +
    '<p style="color: #6b6b6b; font-size: 13px;">You are receiving this because someone ' +
    'added you as their emergency contact in PackRat.</p></div>'
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
        html: renderEmailHtml(message),
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
