import type { EmailContent, EmailTone } from './messages';

/**
 * The HTML email an emergency contact receives. Table layout with inline
 * styles, because that is what renders consistently across Gmail, Outlook and
 * Apple Mail; no images, so nothing depends on the client loading remote
 * content.
 */

const BRAND = '#429575';

const TONES: Readonly<Record<EmailTone, { accent: string; pillBg: string; pillFg: string }>> =
  Object.freeze({
    info: { accent: BRAND, pillBg: '#e6f2ed', pillFg: '#2d6b53' },
    success: { accent: '#2f8f4e', pillBg: '#e5f4ea', pillFg: '#23703c' },
    warning: { accent: '#c77700', pillBg: '#fdf1df', pillFg: '#8f5600' },
    danger: { accent: '#c62828', pillBg: '#fde8e8', pillFg: '#a11d1d' },
    neutral: { accent: '#5f6b66', pillBg: '#eef0ef', pillFg: '#46504c' },
  } as const);

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const AMP = /&/g;
const LT = /</g;
const GT = />/g;
const QUOTE = /"/g;
const APOS = /'/g;

export const escapeHtml = (value: string) =>
  value
    .replace(AMP, '&amp;')
    .replace(LT, '&lt;')
    .replace(GT, '&gt;')
    .replace(QUOTE, '&quot;')
    .replace(APOS, '&#39;');

function detailsTable(details: EmailContent['details']): string {
  if (details.length === 0) return '';
  const rows = details
    .map(
      (d, i) => `<tr>
<td style="padding:12px 16px;${i > 0 ? 'border-top:1px solid #e6e8e7;' : ''}font:600 12px/1.4 ${FONT};color:#6b7570;text-transform:uppercase;letter-spacing:.04em;width:38%;vertical-align:top;">${escapeHtml(d.label)}</td>
<td style="padding:12px 16px;${i > 0 ? 'border-top:1px solid #e6e8e7;' : ''}font:15px/1.45 ${FONT};color:#1c2420;vertical-align:top;">${escapeHtml(d.value)}</td>
</tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e8e7;border-radius:10px;border-collapse:separate;margin:8px 0 24px;">${rows}</table>`;
}

function button({ cta, color }: { cta: NonNullable<EmailContent['cta']>; color: string }): string {
  const url = escapeHtml(cta.url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;"><tr>
<td style="border-radius:8px;background:${color};">
<a href="${url}" style="display:inline-block;padding:13px 24px;font:600 15px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(cta.label)}</a>
</td></tr></table>
<p style="margin:12px 0 0;font:13px/1.5 ${FONT};color:#6b7570;">Or open this link: <a href="${url}" style="color:${BRAND};word-break:break-all;">${url}</a></p>`;
}

export function renderSafetyEmail({
  subject,
  email,
}: {
  subject: string;
  email: EmailContent;
}): string {
  const tone = TONES[email.tone];
  const paragraphs = email.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font:16px/1.55 ${FONT};color:#2b3530;">${escapeHtml(p)}</p>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f2;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(email.paragraphs[0] ?? subject)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f2;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 4px 16px;font:700 20px/1 ${FONT};color:${BRAND};letter-spacing:-.01em;">PackRat</td></tr>
<tr><td style="background:#ffffff;border-radius:14px;border-top:4px solid ${tone.accent};padding:32px 32px 28px;">
<span style="display:inline-block;padding:5px 10px;border-radius:999px;background:${tone.pillBg};color:${tone.pillFg};font:700 11px/1 ${FONT};text-transform:uppercase;letter-spacing:.08em;">${escapeHtml(email.eyebrow)}</span>
<h1 style="margin:16px 0 16px;font:700 24px/1.25 ${FONT};color:#111814;">${escapeHtml(email.heading)}</h1>
${paragraphs}
${detailsTable(email.details)}
${email.cta ? button({ cta: email.cta, color: tone.accent }) : ''}
</td></tr>
<tr><td style="padding:20px 8px 0;font:12px/1.6 ${FONT};color:#7a837f;">
You're receiving this because someone added you as their emergency contact in PackRat, the trip planning app. Messages come from PackRat, never from their own address.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
