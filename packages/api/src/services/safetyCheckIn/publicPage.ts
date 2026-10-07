import { safeJsonStringify } from '@packrat/utils';
import type { PublicCheckInView } from './checkInService';
import { overdueAt } from './checkInService';
import { escapeHtml } from './emailTemplate';
import { describeGear, formatClockTime, formatDuration, formatMessageTime } from './messages';

/** JSON safe to inline in a <script> block. */
const inlineJson = (value: unknown) => safeJsonStringify(value).replaceAll('<', '\\u003c');

const STYLES = `
  :root { color-scheme: light dark; --fg:#1a1a1a; --muted:#6b6b6b; --bg:#f6f5f2; --card:#fff; --line:#e4e2dc; --accent:#2f6b4f; --alert:#b3261e; }
  @media (prefers-color-scheme: dark) { :root { --fg:#f2f2f2; --muted:#a3a3a3; --bg:#121212; --card:#1e1e1e; --line:#2e2e2e; --accent:#7cc5a0; --alert:#ff8a80; } }
  * { box-sizing: border-box; }
  body { margin:0; font:16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background:var(--bg); color:var(--fg); }
  main { max-width:720px; margin:0 auto; padding:20px 16px 48px; }
  header p { margin:0; color:var(--muted); font-size:14px; }
  h1 { font-size:26px; margin:4px 0 4px; }
  h2 { font-size:15px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); margin:0 0 10px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px; margin-top:14px; }
  .banner { border-radius:14px; padding:14px 16px; margin-top:16px; font-weight:600; }
  .banner.ok { background:color-mix(in srgb, var(--accent) 14%, transparent); color:var(--accent); }
  .banner.overdue { background:color-mix(in srgb, var(--alert) 14%, transparent); color:var(--alert); }
  .banner small { display:block; font-weight:400; color:var(--fg); margin-top:4px; }
  #map { height:320px; border-radius:12px; margin-top:4px; }
  dl { display:grid; grid-template-columns:auto 1fr; gap:6px 16px; margin:0; }
  dt { color:var(--muted); }
  dd { margin:0; }
  ul { margin:0; padding-left:18px; }
  li { margin:3px 0; }
  .muted { color:var(--muted); font-size:14px; }
  footer { margin-top:28px; color:var(--muted); font-size:13px; text-align:center; }
`;

function page({ title, body, head = '' }: { title: string; body: string; head?: string }): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title><style>${STYLES}</style>${head}</head>
<body><main>${body}<footer>Shared with you through PackRat safety check-in.</footer></main></body></html>`;
}

export function renderEndedPage(): string {
  return page({
    title: 'Trip ended — PackRat',
    body: `<header><p>PackRat safety check-in</p><h1>This trip has ended</h1></header>
<div class="card"><p>The person who shared this page has marked themselves safe or ended their check-in, so their trip details and locations are no longer available.</p></div>`,
  });
}

export function renderCheckInPage({
  view,
  now = new Date(),
}: {
  view: PublicCheckInView;
  now?: Date;
}): string {
  const { checkIn, trip, userName, locations, gear } = view;
  const tz = checkIn.timeZone;
  const due = overdueAt(checkIn);
  const isOverdue = now >= due;
  const last = locations.at(-1) ?? null;
  const checkIns = locations.filter((l) => l.kind === 'check_in').reverse();
  const identifying = describeGear(checkIn.identifyingGear);

  const banner = isOverdue
    ? `<div class="banner overdue">${escapeHtml(userName)} is overdue by ${formatDuration(
        (now.getTime() - checkIn.expectedReturnAt.getTime()) / 60_000,
      )}.<small>If you can't reach them, contact the local authorities and share this page.</small></div>`
    : `<div class="banner ok">On their trip. Expected back ${escapeHtml(
        formatMessageTime({ date: checkIn.expectedReturnAt, timeZone: tz }),
      )}.<small>If they haven't marked themselves safe by ${escapeHtml(
        formatMessageTime({ date: due, timeZone: tz }),
      )}, you'll get an alert.</small></div>`;

  const lastKnown = last
    ? `<p><strong>${escapeHtml(formatMessageTime({ date: last.recordedAt, timeZone: tz }))}</strong> — ${
        last.placeName
          ? `near ${escapeHtml(last.placeName)}`
          : `${last.latitude.toFixed(5)}, ${last.longitude.toFixed(5)}`
      }</p>${
        last.placeName
          ? `<p class="muted">${last.latitude.toFixed(5)}, ${last.longitude.toFixed(5)}</p>`
          : ''
      }`
    : '<p class="muted">No location has been shared yet.</p>';

  const checkInList =
    checkIns.length > 0
      ? `<ul>${checkIns
          .map(
            (c) =>
              `<li><strong>${escapeHtml(formatClockTime({ date: c.recordedAt, timeZone: tz }))}</strong> ${
                c.placeName ? `near ${escapeHtml(c.placeName)}` : ''
              }${c.note ? ` — “${escapeHtml(c.note)}”` : ''}</li>`,
          )
          .join('')}</ul>`
      : '<p class="muted">No check-ins yet.</p>';

  const gearList =
    gear.length > 0
      ? `<ul>${gear
          .map(
            (g) =>
              `<li>${escapeHtml(g.name)}${g.quantity > 1 ? ` ×${g.quantity}` : ''}${
                g.worn ? ' <span class="muted">(worn)</span>' : ''
              }</li>`,
          )
          .join('')}</ul>`
      : '<p class="muted">No gear list was shared for this trip.</p>';

  const mapData = {
    path: locations.map((l) => [l.latitude, l.longitude]),
    checkIns: checkIns.map((l) => [l.latitude, l.longitude]),
    route: (trip.plannedRoute ?? []).map((p) => [p.latitude, p.longitude]),
    destination: trip.location ? [trip.location.latitude, trip.location.longitude] : null,
  };
  const hasMap =
    mapData.path.length > 0 || mapData.route.length > 0 || mapData.destination !== null;

  const head = hasMap
    ? `<meta http-equiv="refresh" content="120">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" defer></script>`
    : '<meta http-equiv="refresh" content="120">';

  const mapScript = hasMap
    ? `<script>window.addEventListener('load', function () {
  var d = ${inlineJson(mapData)};
  var map = L.map('map', { scrollWheelZoom: false });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
  var bounds = [];
  if (d.route.length) { L.polyline(d.route, { color: '#888', dashArray: '6 6', weight: 3 }).addTo(map); bounds = bounds.concat(d.route); }
  if (d.path.length) { L.polyline(d.path, { color: '#2f6b4f', weight: 4 }).addTo(map); bounds = bounds.concat(d.path); }
  d.checkIns.forEach(function (p) { L.circleMarker(p, { radius: 6, color: '#2f6b4f', fillOpacity: 1 }).addTo(map); });
  if (d.path.length) { var last = d.path[d.path.length - 1]; L.circleMarker(last, { radius: 9, color: '#b3261e', fillOpacity: 1 }).addTo(map).bindPopup('Last known location'); }
  if (d.destination) { L.marker(d.destination).addTo(map).bindPopup('Destination'); bounds.push(d.destination); }
  if (bounds.length === 1) map.setView(bounds[0], 13); else map.fitBounds(bounds, { padding: [24, 24] });
});</script>`
    : '';

  const destination = trip.location?.name ? escapeHtml(trip.location.name) : null;

  const body = `<header><p>PackRat safety check-in</p>
<h1>${escapeHtml(userName)} · ${escapeHtml(trip.name)}</h1>
<p>Started ${escapeHtml(formatMessageTime({ date: checkIn.startedAt, timeZone: tz }))}</p></header>
${banner}
${hasMap ? '<div class="card"><h2>Progress</h2><div id="map"></div></div>' : ''}
<div class="card"><h2>Last known location</h2>${lastKnown}</div>
<div class="card"><h2>Trip plan</h2><dl>
${destination ? `<dt>Destination</dt><dd>${destination}</dd>` : ''}
<dt>Expected back</dt><dd>${escapeHtml(formatMessageTime({ date: checkIn.expectedReturnAt, timeZone: tz }))}</dd>
<dt>Overdue alert</dt><dd>${escapeHtml(formatMessageTime({ date: due, timeZone: tz }))}</dd>
${identifying ? `<dt>Look for</dt><dd>${escapeHtml(identifying)}</dd>` : ''}
</dl></div>
<div class="card"><h2>Check-ins</h2>${checkInList}</div>
<div class="card"><h2>Full gear list</h2>${gearList}</div>
${mapScript}`;

  return page({ title: `${userName} · ${trip.name} — PackRat`, body, head });
}
