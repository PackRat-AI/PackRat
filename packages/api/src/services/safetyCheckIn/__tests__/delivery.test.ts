import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  getEnv: vi.fn(),
  captureApiException: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@packrat/api/utils/email', () => ({ sendEmail: mocks.sendEmail }));
vi.mock('@packrat/api/utils/env-validation', () => ({ getEnv: mocks.getEnv }));
vi.mock('@packrat/api/utils/sentry', () => ({ captureApiException: mocks.captureApiException }));

import { deliverToContact, deliverToContacts, renderEmailText } from '../delivery';
import { renderSafetyEmail } from '../emailTemplate';
import type { SafetyMessage } from '../messages';

const message: SafetyMessage = {
  subject: 'Subject',
  text: 'Hi <you> & co. See https://x.test/a/b.',
  email: {
    tone: 'danger',
    eyebrow: 'Overdue',
    heading: 'Alex is <overdue>',
    paragraphs: [`Try "them" & 'call'.`],
    details: [{ label: 'Trip', value: 'Enchantments' }],
    cta: { label: 'Open trip page', url: 'https://x.test/a?b=1&c=2' },
  },
};
const twilio = {
  TWILIO_ACCOUNT_SID: 'AC123',
  TWILIO_AUTH_TOKEN: 'secret',
  TWILIO_FROM_NUMBER: '+18885550100',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  mocks.getEnv.mockReturnValue(twilio);
  mocks.fetch.mockResolvedValue(new Response('{}', { status: 201 }));
  mocks.sendEmail.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('renderSafetyEmail', () => {
  it('escapes every piece of user content', () => {
    const html = renderSafetyEmail(message);
    expect(html).toContain('Alex is &lt;overdue&gt;');
    expect(html).toContain('Try &quot;them&quot; &amp; &#39;call&#39;.');
    expect(html).toContain('href="https://x.test/a?b=1&amp;c=2"');
    expect(html).not.toContain('<overdue>');
  });

  it('uses the tone colour for the accent and button, and lists details', () => {
    const html = renderSafetyEmail(message);
    expect(html).toContain('border-top:4px solid #c62828');
    expect(html).toContain('background:#c62828');
    expect(html).toContain('>Trip</td>');
    expect(html).toContain('>Enchantments</td>');
    expect(html).toContain('>Open trip page</a>');
  });

  it('leaves out the details table and button when there are none', () => {
    const html = renderSafetyEmail({
      ...message,
      email: { ...message.email, details: [], cta: undefined },
    });
    expect(html).not.toContain(
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid',
    );
    expect(html).not.toContain('Or open this link');
  });
});

describe('renderEmailText', () => {
  it('is the message plus why they are receiving it', () => {
    expect(renderEmailText(message)).toBe(
      `${message.text}\n\nYou're receiving this because someone added you as their emergency contact in PackRat.`,
    );
  });
});

describe('deliverToContact', () => {
  it('sends SMS via Twilio and email via Resend', async () => {
    const result = await deliverToContact({
      contact: { name: 'Mom', phone: '+15005550006', email: 'mom@example.com' },
      message,
      operation: 'start',
      checkInId: 'ci-1',
    });

    expect(result).toEqual({ sms: 'sent', email: 'sent' });
    const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe(
      `Basic ${btoa('AC123:secret')}`,
    );
    const body = new URLSearchParams(init.body as string);
    expect(body.get('To')).toBe('+15005550006');
    expect(body.get('From')).toBe('+18885550100');
    expect(body.get('Body')).toBe(message.text);
    expect(mocks.sendEmail).toHaveBeenCalledWith({
      to: 'mom@example.com',
      subject: 'Subject',
      html: renderSafetyEmail(message),
      text: renderEmailText(message),
    });
  });

  it('skips channels the contact has no address for', async () => {
    const result = await deliverToContact({
      contact: { name: 'Nobody', phone: null, email: null },
      message,
      operation: 'start',
    });
    expect(result).toEqual({ sms: 'skipped', email: 'skipped' });
    expect(mocks.fetch).toHaveBeenCalledTimes(0);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(0);
  });

  it('skips SMS when Twilio is not configured', async () => {
    mocks.getEnv.mockReturnValue({});
    const result = await deliverToContact({
      contact: { name: 'Mom', phone: '+15005550006', email: null },
      message,
      operation: 'start',
    });
    expect(result).toEqual({ sms: 'skipped', email: 'skipped' });
    expect(mocks.fetch).toHaveBeenCalledTimes(0);
  });

  it('captures a Twilio error and still sends email', async () => {
    mocks.fetch.mockResolvedValue(new Response('bad number', { status: 400 }));
    const result = await deliverToContact({
      contact: { name: 'Mom', phone: '+15005550001', email: 'mom@example.com' },
      message,
      operation: 'overdue',
      checkInId: 'ci-1',
    });
    expect(result).toEqual({ sms: 'failed', email: 'sent' });
    const call = mocks.captureApiException.mock.calls[0]?.[0];
    expect(call.operation).toBe('safetyCheckIn.overdue.sms');
    expect(call.error.message).toBe('Twilio send failed: 400 bad number');
    expect(call.error.httpStatus).toBe(400);
    expect(call.extra).toEqual({ checkInId: 'ci-1' });
  });

  it('captures an email failure without throwing', async () => {
    mocks.sendEmail.mockRejectedValue(new Error('resend down'));
    const result = await deliverToContact({
      contact: { name: 'Mom', phone: null, email: 'mom@example.com' },
      message,
      operation: 'safe',
    });
    expect(result).toEqual({ sms: 'skipped', email: 'failed' });
    expect(mocks.captureApiException.mock.calls[0]?.[0].operation).toBe('safetyCheckIn.safe.email');
  });
});

describe('deliverToContacts', () => {
  it('delivers to every contact', async () => {
    const results = await deliverToContacts({
      contacts: [
        { name: 'A', phone: '+15005550006', email: null },
        { name: 'B', phone: null, email: 'b@example.com' },
      ],
      message,
      operation: 'start',
    });
    expect(results).toEqual([
      { sms: 'sent', email: 'skipped' },
      { sms: 'skipped', email: 'sent' },
    ]);
  });
});
