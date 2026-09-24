# Weather Alerts — device test drive

**Environment prepared 2026-09-24.** Isolated: its own Neon branch and its own
Worker. The shared dev database is untouched.

| Piece | Value |
|---|---|
| Worker | `packrat-api-weather` → `https://packrat-api-weather.orange-frost-d665.workers.dev` |
| Neon branch | `devenv/worktree-weather-alerts-proactive` (`br-soft-fog-a4cca5gn`) |
| Device | Ibrahim's iPhone 11 · `363E9C01-373A-539D-8979-7F1180E81599` |
| Build | Debug, `PACKRAT_ENV=weather`, `aps-environment=development` |
| APNs host | sandbox (matches the Development profile) |
| Feature flag | `enableWeatherMonitoring` = true, `weather-monitoring` generally available |
| Swift flag | `AppFeatureFlags.enableWeatherMonitoring = true` |

## Before you start — two commands I could not run

Both were blocked by the permission classifier, not by any failure.

```bash
cd packages/api

# 1. Secrets for the new worker (sourced from the main checkout's .env.local,
#    with NEON_DATABASE_URL overridden to the isolated branch).
bun ../../scripts/wa-secrets.ts | bunx wrangler secret bulk --config wrangler.weather.jsonc

# 2. Deploy it.
bunx wrangler deploy --config wrangler.weather.jsonc
```

Then confirm the worker is up:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  https://packrat-api-weather.orange-frost-d665.workers.dev/health          # 200
```

## Test locations (verified live on WeatherAPI today)

The poller reads **WeatherAPI.com**, not NWS — these were confirmed against the
exact endpoint the cron uses.

| Location | id | Live alerts |
|---|---|---|
| Myrtle Beach, SC | `2646597` | Beach Hazards, Small Craft, Coastal Flood |
| Wilmington, NC | `2625470` | Coastal Flood, High Surf |
| Hilo, HI | `2564405` | Hurricane Watch |

Re-verify on the day you test:

```bash
curl -s "https://api.weatherapi.com/v1/forecast.json?key=$WEATHER_API_KEY&q=id:2646597&days=1&alerts=yes" \
  | python3 -c "import sys,json;d=json.loads(sys.stdin.read(),strict=False);print(len(d.get('alerts',{}).get('alert',[])),'alerts')"
```

Note: alert bodies contain raw control characters, so a strict JSON parser
throws. That exception means alerts *are* present — parse with `strict=False`.

## Monitors

Run in a spare terminal; each reads the isolated branch.

```bash
./scripts/wa-monitor.sh watch    # watch-list rows
./scripts/wa-monitor.sh tokens   # registered APNs device tokens
./scripts/wa-monitor.sh state    # per-location alert state + poll tier
./scripts/wa-monitor.sh reset    # clear alert state, so alerts re-notify
```

Live worker logs (shows each cron pass and the APNs HTTP status):

```bash
cd packages/api && bunx wrangler tail --config wrangler.weather.jsonc --format pretty
```

Look for `[weatherMonitoring] poll: checked=N skipped=N failed=N notified=N`.

## Test steps

1. **Launch** PackRat on the iPhone (already installed) and sign in.
   Expect **no** notification prompt at sign-in — that is correct, the prompt is
   contextual.

2. **Open Weather.** The watch-list UI should be visible. If it is not, the
   Swift compile-time flag did not take — rebuild.

3. **Search for `Myrtle Beach` and add it to the watch list.**
   - The iOS notification permission prompt fires here, on the first successful
     add. **Allow it.**
   - `./scripts/wa-monitor.sh watch` → one row.
   - `./scripts/wa-monitor.sh tokens` → one row with a real APNs token. If this
     stays empty, push cannot work; stop and check the entitlement.

4. **Contextual banner.** Because Myrtle Beach currently has an alert, the
   "add to watch list?" prompt behaviour and the in-app alert list should both
   show it. The tab badge should reflect the active alert.

5. **Wait for the cron** (`*/5`, so ≤5 minutes) and watch `wrangler tail`.
   First pass for a new location polls immediately — there is no state row yet,
   so nothing is skipped.
   - Expect `notified=1` and an APNs `200` against `api.sandbox.push.apple.com`.
   - **The push should arrive on the phone.** Background the app first; a
     foreground app may present it differently.

6. **Confirm state persisted.** `./scripts/wa-monitor.sh state` → a row for
   `2646597` with `poll_tier = elevated` (it has an active alert) and populated
   `last_alert_ids`.

7. **Deep link.** Tap the notification. It should open the alert in-app.

8. **No re-notify.** Wait another cron pass. Expect `notified=0` — alerts only
   notify on new ids, never on repeat or resolution.

9. **Re-test delivery.** To make the same alert fire again:
   ```bash
   ./scripts/wa-monitor.sh reset
   ```
   The next cron pass treats every current alert as new and pushes again.

10. **Second location.** Add Hilo (`2564405`) to confirm multi-location polling
    and that one push per location arrives.

## Gotchas that will bite

- **Push needs the deployed worker.** `wrangler dev` can never deliver — workerd
  has no HTTP/2 client and APNs refuses HTTP/1.1
  ([workerd#4841](https://github.com/cloudflare/workerd/issues/4841)).
- **Host must match the build.** This build is Development → sandbox. A mismatch
  returns `BadDeviceToken`, which the client treats as an invalid token and
  **deletes the row** — the token table drains silently instead of erroring. If
  `tokens` empties itself, suspect this first.
- **Alert ids are `` `${event}|${effective}` ``**, not the bare event.
- **`403 InvalidProviderToken`** points at the key's provenance (wrong team,
  APNs service not ticked), not at the signing code.
- **Polling is tiered**: 20 min baseline, 5 min once a location is alerting.

## Teardown

```bash
bun devenv down     # deletes the Neon branch
cd packages/api && bunx wrangler delete --config wrangler.weather.jsonc
```
