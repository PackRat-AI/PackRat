# Weather alerts

Warns a user about hazardous conditions for the location they're planning
around, without requiring them to read a full forecast to spot the risk.

## What it does

Every location a user checks the weather for is also checked for active
alerts — official warnings like severe storms, extreme heat, high wind, or
poor air quality. When conditions warrant it, the app surfaces a clear
warning: what the hazard is, how serious it is, where it applies, when it
starts and ends, and what to do about it.

If there's nothing to warn about, the user sees a plain "no active alerts"
state rather than an empty or confusing screen.

## Where a user finds it

- A bell icon on the weather screen, which fills in and turns red when there's
  something active — otherwise it stays neutral.
- A dedicated Alerts screen listing every current alert for the selected
  location, each one expandable for full detail.
- Alert Preferences, where a user can choose which alert types they want to
  be notified about and toggle notifications and location monitoring on or
  off.

## What an alert tells you

Each alert shows:

- **What it is** — e.g. Heat Advisory, High Wind, Rain Alert.
- **Severity** — Low, Moderate, or High, shown with a matching color so it
  reads at a glance.
- **Where** — the affected area.
- **When** — the active window.
- **Details and guidance** — a plain-language description and, where
  available, what to do about it (e.g. "stay hydrated," "carry an umbrella").

## Staying current

Alerts refresh whenever the selected location changes, so switching between a
home location and a trip destination always reflects that location's own
conditions rather than stale data from wherever the user checked last.

## Cross-platform differences

The core experience — bell icon, Alerts screen, severity, detail — is the
same on iOS and Android. They diverge on what happens when there's no
official alert for a location:

- **iOS** shows only official alerts. No official warning means a plain "no
  active alerts" state, full stop.
- **Android** goes further: when there's no official alert, it also checks
  the raw conditions itself — extreme heat or cold, strong wind, rain or low
  visibility either happening now or expected in the next few hours, high UV,
  and poor air quality — and raises its own advisory if any of those are
  present. Only when none of those apply either does it fall back to "no
  active alerts."

In practice, an Android user is more likely to get a heads-up in borderline
conditions an official alert system hasn't caught up to; an iOS user only
ever sees what the official source has actually issued.

One smaller difference: on iOS, a user's Alert Preferences choices persist
across app launches. On Android, they reset each time the Alert Preferences
screen is reopened, so a user has to re-set them every visit.

## Known limitation

On both platforms, Alert Preferences is not yet connected to anything —
turning off a specific alert type (e.g. Tornado Warnings) or disabling
Weather Notifications does not currently change which alerts are shown or
change any notification behavior. The screen exists and saves a choice, but
nothing downstream reads it yet.
