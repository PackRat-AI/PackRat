# Offline maps

Lets a hiker save the map for an area to their phone before they go, so the map keeps working where there is no signal.

## The model in one paragraph

Before a trip, a user picks an area on the map and saves it. The app shows how much space the area will take before anything downloads, then downloads it in the background with visible progress. Once saved, every map in PackRat shows that area in full detail with no network: trail pages, trip maps and the stats map all draw from the saved area when the phone is offline. A trip offers to save the map around its trail or destination, because that is when people think about it. Saved areas live on the device and are listed in one place, where the user can see what each one takes up, refresh it, or delete it. Nothing is saved without the user asking for it.

## Choosing an area

The user starts from a trip, a trail page, or the Offline maps screen. A trip or trail suggests an area that covers its route or destination with a margin around it; the user can accept it or adjust the frame. From the Offline maps screen the user pans and zooms to frame any area by hand, or picks a named region such as a national park, state or county. A named region saves the map inside that region's boundary rather than a rectangle around it, so a park download does not pay for the land around it. Both paths lead to the same detail choice, size estimate and download.

The user chooses how much detail to keep: **Standard** covers overview and road-level detail, **Trail detail** adds the closest zoom levels used for following a path. The estimated size updates as the frame and detail level change. An area too large to save at the chosen detail is flagged before download, with a prompt to shrink the frame or lower the detail.

Each saved area takes a name, suggested from the trip, trail or place it covers, which the user can change.

## Downloading

A download shows its progress as a percentage and the size so far, on the Offline maps screen and on the trip or trail it came from. It continues if the user leaves the screen or locks the phone, and resumes where it stopped if the connection drops. The user can cancel at any time; a cancelled download leaves nothing behind.

Downloads use Wi-Fi by default. The user can allow cellular downloads in settings. Starting a download on cellular with that setting off asks first.

## Using maps offline

When the phone is offline, any map in PackRat that falls inside a saved area shows it at full detail, and the user's location still appears on it. Outside saved areas, the map shows whatever it has already loaded and leaves the rest blank. A trip with a saved area shows a "Saved for offline" badge, so the user can confirm before leaving signal.

## Managing storage

The Offline maps screen lists each saved area with its name, size, detail level and the date it was saved, plus the total space used. From there the user can:

- **Rename** an area.
- **Update** an area to the latest map data.
- **Delete** an area, or delete all of them at once.

Areas saved for a trip are marked with that trip. After a trip ends, its area stays until the user deletes it; the screen highlights areas tied to trips that have finished so they are easy to clear out.

The user can set a storage limit for offline maps. A download that would exceed the limit asks the user to free space first and shows which areas would cover it.

## What the user controls

- Which areas are saved, how large, and at what detail.
- Whether downloads can use cellular data.
- The storage limit for offline maps.
- Renaming, updating and deleting saved areas.

## What this feature does not do

- **Automatic deletion.** Saved areas are never removed without the user deleting them.
- **Automatic downloads.** The app suggests saving a trip's area; it never downloads on its own.
- **Offline search or routing.** Saved areas are for viewing the map and the user's position, not for looking up places or planning a route without signal.
- **Sharing saved areas** between users or devices.
