# Trip weather

Shows a user what the weather will be like at their trip's destination while they are there, and warns them of any hazard over it, from inside the trip itself.

## The model in one paragraph

A trip already knows where it is and when it happens. Its detail screen uses both to show the forecast for the trip's own days at the trip's own place, so a user never has to find the destination again in the weather tab. Any active hazard for that place sits at the top of that section, the same alert a saved location's forecast shows. From the same section the user can watch the destination with one tap, and they then get pushed about new hazards there for as long as the trip lasts. Watching is always something the user chooses; planning a trip never subscribes them to anything on its own.

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

The Weather section offers **Watch for alerts** on any upcoming or ongoing trip. One tap saves the destination as a weather location, if it is not one already, and watches it. From then on the user is pushed about new hazards there exactly as for any watched location, and tapping the notification opens the trip.

A watch started from a trip belongs to that trip. It appears in the watch list under the trip's name, and it ends on its own the day after the trip's last day, or when the trip is deleted. The saved location stays in the weather list either way. A user who wants to keep watching the place past the trip can watch it again from the weather list, where it becomes an ordinary watch with no end date.

When a hazard is already active over the destination and the trip is not watched, the alert repeats the offer, since that is the moment watching matters most.

## User controls

- Watch or stop watching a trip's destination from the trip's Weather section or from the watch list.
- Open the destination's full forecast from the trip.
- Change the trip's location or dates; the forecast, alerts and any trip watch follow the change.

## What this feature does not do

- Watch a trip's destination automatically. Planning a trip never creates a watch on its own.
- Show seasonal or historical averages for trips beyond forecast range.
- Forecast more than one point per trip, such as along a route or at each campsite.
- Notify about hazards for a trip that has ended.
- Offer per-hazard-type notification controls for trip watches.
