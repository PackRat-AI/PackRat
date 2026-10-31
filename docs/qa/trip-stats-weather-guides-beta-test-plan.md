# Trip Stats, weather and guides: beta tester guide

PackRat 2.3 is the first round for Trip Stats and weather on both phones. Trip Stats builds a record of your time outdoors from your trips, and weather now has a watch list that sends you a notification when an alert is issued for a place you care about. Android also gets a redesigned Guides section, and on iPhone, signing in and Wildlife ID have changed. The Android build is an APK from the link in the release announcement, and the iPhone build comes from TestFlight.

The app should feel the same on both phones. It is worth reporting where it does not.

## Android

Download the APK from the link in the release announcement and install it over your current PackRat. Your phone may ask you to allow installs from your browser first.

Five tabs run along the bottom: Dashboard, Packs, Trips, Catalog and Profile, with Feed as a sixth if it is switched on for you. Trip Stats, Weather and Guides are tiles on the Dashboard.

### Trip Stats

Trip Stats builds a record of your time outdoors from the trips you have already taken. It needs a few trips whose end dates have passed, so create two or three past trips with real places and dates before you start if your account does not have them.

- Open Trip Stats from its Dashboard tile, then again from Profile. Expect the same screen both ways.
- On an account with no finished trips, expect "Your Record Starts Here" with a Plan a Trip button, not an empty page.
- With finished trips, look at the All Time card. Expect Trips, Nights Out and Days Outdoors to match what you would count by hand from your trips.
- Look at This Year. Expect it to compare against the same dates last year, or to say "Your first year on the record" if you have no trips from last year.
- Scroll to Where You've Been. Expect a map with a pin for each place you went, not a grey or blank map.
- Check Highlights. Expect Longest trip, Farthest trip and Busiest month to name trips and months you recognise.
- Scroll to Packed Most Often. Expect the gear from packs you attached to those trips, with a count like "3 trips" beside each item.

### Goals

- Tap Add goal at the top of Trip Stats. Pick This Year, choose Nights Out as the measure and set a target. Expect it to appear under Goals with a line like "4 of 10" and a pace note such as "On pace" or "2 nights behind pace".
- Make a second goal with Custom Dates and a name of your own. Expect the name you typed to show on the card.
- Edit a goal and change its target. Expect the progress line to update straight away.
- Delete a goal. Expect it to ask "Delete this goal?" and to say your trips and stats stay as they are. Expect your stats not to change once it is gone.

### Trip log

- Open a finished trip. Expect a Trip log section asking "How did it go?" with a Log this trip button.
- Log the trip with an activity, a distance and an elevation gain, then go back to Trip Stats. Expect Distance and Elevation Gained to include what you entered, and the activity to show up under Activities.
- Import a GPX file of a route if you have one. Expect a line like "Route with 1,240 points". Try a file that is not a GPX track and expect "This file isn't a GPX track PackRat can read."
- Turn off Count in Trip Stats on one trip. Expect the trip to be marked "Not in Trip Stats" and to drop out of your totals. Turn it back on and expect it to return.

### National Parks and peaks

- Open National Parks from Trip Stats. Expect a count like "3 of 63", with parks your trips passed through already ticked off.
- Use Add a past visit to add a park you went to before you used PackRat. Expect it to be marked "Added by hand" and to count towards the total.
- Open Peaks and tap Add a past summit, then Choose a peak. Expect a map with peaks On your route or Nearby, and a list that moves with the map.
- Pick a peak with Use this peak. Expect it to appear under Peaks, and expect the highest one to be shown as "Highest · " followed by its name.
- Try Enter a peak by hand with a name and an elevation. Expect it to save like any other peak.

### Weather

- Open Weather from the Dashboard. On a fresh account, expect "No saved locations" with a prompt to search for a city or place.
- Search for a city and add it. Expect it to appear in your list with today's temperature and conditions.
- Open the location. Expect the current conditions, a 10-day forecast, and details such as Feels Like, Visibility and UV Index.
- Tap Watch this location. Expect "You'll get alerts for" followed by the place name, and the location to show as "Watched for alerts". Allow notifications when your phone asks.
- Open the Watch list. Expect every place you are watching to be there.
- Stop watching a place, then tap Undo on the message that appears. Expect it to go back on your watch list.
- Turn PackRat's notifications off in your phone's settings and return to Weather. Expect "Notifications are off for PackRat" with a Settings button that takes you to the right place.
- Switch the temperature unit between Celsius and Fahrenheit. Expect every temperature on the screen to change.

### Weather alerts

Alerts come from official weather warnings, so the test needs a place that has one right now. The National Weather Service map at https://www.weather.gov colours in every part of the US under a warning, watch or advisory. Pick a town inside one of the coloured areas. For Europe, https://meteoalarm.org does the same.

- Search for your town in Weather, add it and open it. Expect the alert under "Active alert", with Show details opening the full text.
- Tap Watch this location. Within half an hour, expect a notification naming the alert, even if PackRat is closed.
- Fully close PackRat and lock your phone, then watch a second town that has an alert. Expect its notification to arrive all the same.
- Open the Watch list. Expect both towns marked "Watched for alerts".
- Stop watching one town. Expect no further notifications for it, while the other keeps working.
- Ask another tester which town they are watching and watch it too. Expect the same alert notification to reach you, even though they got theirs first.

### Guides

- Open Guides from the Dashboard and scroll quickly up and down. Expect the list to stay still and steady, with no flashing or jumping as it loads.
- Tap a topic such as Gear Essentials or Trip Planning. Expect only guides from that topic, or "No Gear Essentials guides yet" if it has none.
- Search for something like "tent". Expect a count like "8 results". Search for nonsense and expect "No results for" followed by what you typed.
- Open a guide. Expect the author, the reading time and the update date near the top, and Related guides at the bottom.

### Maps

- Open any screen with a map, such as Where You've Been in Trip Stats or the peak picker. Expect real map tiles with roads and terrain, not a blank grid.

### Offline

- Use Trip Stats and Weather normally for a few minutes so the app has something cached, then turn on airplane mode and reopen PackRat. Expect Trip Stats to show the same numbers it did online.
- Still offline, add a goal and log a trip. Expect both to save and show up in Trip Stats straight away.
- Open Weather offline. Expect your saved locations with their last known conditions, not an empty list or a spinner that never ends.
- Open a guide you have not read before. Expect "Couldn't load this guide" with a Try again button, and expect Try again to load it once you are back online.
- Turn airplane mode off and wait a moment. Expect the goal and the trip log you made offline to still be there, with no duplicates.
- Install the build on a second phone or sign in elsewhere on the same account. Expect your goals and trip logs to come across.

## iPhone

Install the update from TestFlight.

Five tabs run along the bottom: Home, Packs, Trips, Assistant and Profile. Trip Stats is a card on Home and in Profile, and Weather is on Home.

### Trip Stats

As on Android, Trip Stats needs a few trips whose end dates have passed, with real places and dates.

- Open Trip Stats from its card on Home, then again from Profile. Expect the same screen both ways.
- On an account with no finished trips, expect "Your Record Starts Here" rather than an empty page.
- With finished trips, check the All Time totals against your own count of trips, nights out and days outdoors. Expect them to match.
- Change the year and activity filters at the top. Expect every section below to follow the filter, and "No Trips Match" when nothing fits.
- Scroll to Where You've Been. Expect a pin for each place, grouped into a single numbered pin where several sit close together and splitting apart as you zoom in.
- Open Countries & States. Expect the places you have been, and nothing you have not.
- Open Landscapes. Expect your trips grouped by the kind of landscape they took place in. Touch and hold a trip to move it to another landscape, and expect it to stay there.
- Scroll to Not Packed in a Year. Expect gear that has sat in your packs for over a year without going on a finished trip, or "Every item in your packs has been on a trip in the last year."
- Open your Year in Review. Expect it to look back over the year with your own trips and numbers.
- Tap Share and choose Share Image. Expect a card of your stats you can send in Messages or save to your photos.
- Use Export Trips and pick Trips Spreadsheet (CSV), then Routes (GPX). Expect files that open in Numbers or a mapping app and contain your trips.

### Goals

- Tap Add Goal, choose Nights Out and set a target for this year. Expect it under Goals with its progress and a pace note such as "On pace".
- Make a second goal for your own dates, using a name like "Ten nights out before the baby arrives". Expect your name to show on it.
- Use Follow a Long Trail and pick one. Expect your progress along it to show, and Stop Following to remove it with "Your trips still count. Follow it again any time."
- Open a goal and use Share Goal. Expect an image of the goal you can send.
- Delete a goal. Expect "Your trips and stats stay as they are." and your stats unchanged afterwards.

### Trip log

- Open a finished trip and tap Log This Trip. Add an activity, a distance and an elevation gain. Expect them to count in Trip Stats straight away.
- Import a GPX file of a route. Expect the distance, climbing and route to be filled in from the file.
- Use Draw Route to tap out the way you went on the map. Expect a distance to appear as you draw. Tap Out and Back and expect the distance to double.
- Turn off Count in Trip Stats on one trip. Expect it marked "Not in Trip Stats" and gone from your totals, then back when you turn it on again.

### National Parks and peaks

- Open National Parks. Expect parks your trips passed through already ticked off, with "Visits from trips follow the trip. Change the trip to change them."
- Use Add a Past Visit for a park you went to before you used PackRat. Expect it marked "Added by hand".
- Open Peaks and tap Add a Past Summit, then Choose a Peak. Expect a full-screen map with peaks On Your Route and Nearby, and a list that follows the map.
- Try Enter a Peak by Hand for a peak that is not on the map. Expect it to save like any other.

### Weather

- Open Weather from Home. Search for a city with Add Location and add it. Expect its temperature and conditions in your list.
- Open it. Expect the current conditions, an hourly strip and a daily forecast.
- Tap Watch This Location. Expect "You are watching this location", and the place on your Watch List.
- Switch between Celsius and Fahrenheit. Expect every temperature to change.
- Remove a location. Expect it to disappear from your list and stay gone after you reopen the app.

### Signing in

- Sign out, then sign back in with Apple. Expect to land in the app within a few seconds, not a spinner that ends in "The request timed out."
- Do the same with Google, then with your email and password.
- Try signing in on Wi-Fi and again on mobile data. Expect both to work the same way.
- Type a wrong password on purpose. Expect "Invalid email or password" straight away.
- If sign-in ever spins for a long time or times out, note the time, whether you were on Wi-Fi or mobile data, and which sign-in button you used.

### Weather alerts

Use the same maps as on Android to find a town with an alert right now.

- Open Weather, add the town and open it. Expect the alert to be listed with its details.
- Tap Watch This Location and allow notifications when asked. Within half an hour, expect a notification naming the alert, even with PackRat closed and the phone locked.
- Stop watching the town. Expect no further notifications for it.

### Wildlife ID

- Open Home, tap Wildlife and photograph something PackRat will not recognise, like a coffee mug. Expect "No confident match" with the line "The photo may need another angle or a closer shot. Or this species may not be supported yet."

### Offline

- Turn on airplane mode and try to sign in. Expect a clear message about the connection rather than a long spinner.
- While signed in, turn on airplane mode and reopen the app. Expect your packs and trips to still be there.
- Still offline, open Trip Stats. Expect the same numbers you saw online.
- Add a goal and log a trip offline, then turn airplane mode off. Expect both to still be there, with no duplicates, and to show up on your other devices.
- Open Weather offline. Expect your saved locations with their last known conditions.

## Reporting

Reports go to GitHub issues as usual. On Android, take a screenshot by holding the power and volume down buttons together. On iPhone, press the side button and volume up together. Both land in your photos, ready to attach.

Anything merely annoying rather than broken is still worth reporting.
