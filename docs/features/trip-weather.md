# Trip weather

Shows a user what the weather will be like at their trip's destination while they are there, and warns them of any hazard over it, from inside the trip itself.

## The model in one paragraph

A trip already knows where it is and when it happens. Its detail screen uses both to show the forecast for the trip's own days at the trip's own place, so a user never has to find the destination again in the weather tab. Any active hazard for that place sits at the top of that section, the same alert a saved location's forecast shows. The trip also watches its destination on its own, from three days before it starts until it ends, so the user is pushed about a new hazard there without having to ask.

## The forecast on a trip

A trip with a location shows a Weather section on its detail screen. What it shows depends on when the trip is:

- **Within forecast range.** One row per trip day, with conditions, high and low, and chance of precipitation. The days shown are the trip's days, not the next ten.
- **Partly within range.** The days in range appear, followed by a line saying the remaining days appear as the trip gets closer.
- **Under way.** Today through the trip's last day, with today's current conditions at the top.
- **Beyond range.** A single line: "The forecast for your trip appears 10 days before you leave." No empty rows, no placeholder chart.
- **Over.** No Weather section. A finished trip's screen is about what happened, not what the sky is doing now.

Tapping the section opens the destination's full forecast, the same screen a saved location opens, with hourly detail and condition tiles.

A trip without a location has no Weather section.

## Hazards over the destination

When a hazard is active for the trip's destination, an alert sits at the top of the Weather section, above the daily rows, in the same form as on a location's forecast: what it is, how severe, and its active window, expanding to its area and guidance. It cannot be dismissed. A hazard outranks everything else the trip screen says, so a trip carrying one shows a red marker on its card in the trips list until the user opens it.

Alerts follow the trip's dates the same way the forecast does: a hazard shows while the trip is upcoming or under way, and not once it is over.

## Watching the destination

Every upcoming trip with a destination watches it automatically, from three days before the trip starts until the day after it ends. The user is pushed about new hazards there exactly as for any watched location, and tapping the notification opens the trip. Nothing is asked first; the only prompt is the system's notification permission, requested when the user creates their first trip with a destination.

The watch belongs to the trip. It does not add the destination to the weather list. It appears in the watch list under the trip's name with its end date, and it ends on its own after the trip or when the trip is deleted. A user who wants to keep watching the place beyond the trip can save and watch it from the weather tab, where it becomes an ordinary watch with no end date.

Trip alerts can be turned off for one trip from its Weather section, or for every trip from notification settings.

## User controls

- Turn trip alerts off or back on for one trip from its Weather section.
- Turn trip alerts off for every trip from notification settings.
- Open the destination's full forecast from the trip.
- Change the trip's location or dates; the forecast, alerts and the trip's watch follow the change.

## What this feature does not do

- Show seasonal or historical averages for trips beyond forecast range.
- Forecast more than one point per trip, such as along a route or at each campsite.
- Notify about hazards for a trip that has ended.
- Offer per-hazard-type notification controls for trip watches.
