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
- Alert Preferences, where a user controls how they're notified.

## What an alert tells you

Each alert shows:

- **What it is** — e.g. Heat Advisory, High Wind, Rain Alert.
- **Severity** — Low, Moderate, or High, shown with a matching color so it
  reads at a glance.
- **Where** — the affected area.
- **When** — the active window.
- **Details and guidance** — a plain-language description and, where
  available, what to do about it (e.g. "stay hydrated," "carry an umbrella").

## Severity you can trust

Alerts aren't just pulled from a weather source verbatim — the app also
recognizes conditions that are risky for someone outdoors even when no
official warning has been issued: extreme heat or cold, strong wind, rain or
low visibility either happening now or expected in the next few hours, high
UV, and poor air quality. This means a user planning a trip gets a heads-up
even in places or moments an official alert system hasn't caught up to.

## Staying current

Alerts refresh whenever the selected location changes, so switching between a
home location and a trip destination always reflects that location's own
conditions rather than stale data from wherever the user checked last.
