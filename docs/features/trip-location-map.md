# Trip location, map and form

Lets a user plan a trip in one form, set where it happens, and see that place on a map, from a glance on the trip page to a full-screen view they can explore.

## The model in one paragraph

Every trip can have one place: a trailhead, a park, a town. The user picks it while creating or editing the trip, either by searching for it or by moving the map until the pin sits where they want. Once set, the trip page shows the place as a compact map preview with its name underneath. Expanding the preview opens a full-screen map where the user can pan, zoom and switch to satellite imagery, then hand the place off to their maps app for directions. A finished trip with a recorded route shows that route on both the preview and the full-screen map.

## The trip form

Creating and editing a trip happen in the same single-screen form, grouped the way the user thinks about a trip:

- **Name** at the top.
- **Where**: the trip's place and, optionally, a trail. Each is a whole row the user taps to choose, with a clear button to remove what is set.
- **When**: the start and end dates. On Android one date-range picker sets both; on iPhone, Starts and Ends work like Calendar.
- **Pack**: a chooser lists every pack with its item count and weight, plus **None** and **New Pack**. A pack created from here is linked to the trip straight away.
- **Notes** for anything else.

Saving is in the top bar.

## Picking the place

Choosing **Location** in the trip form opens a full-screen picker. A search field sits at the top and the map fills the rest of the screen, with a pin fixed at its centre.

- **Search**: typing shows matching places as a list of results, each with its name and the region it belongs to. Tapping a result moves the map there and closes the list.
- **Move the map**: dragging the map moves the place under the fixed pin. The name of the place under the pin appears in a panel at the bottom of the screen and updates when the map comes to rest.
- **Current location**: a button on the map centres it on where the user is right now. With no place chosen yet, the picker opens on the user's location when they have already allowed location access.
- **Confirm**: the bottom panel shows the chosen place's name and region with a single **Use this location** button. The picker closes and the trip form shows the place.

A trip that already has a place opens the picker centred on it.

## On the trip page

The trip page shows the place as a map preview with rounded corners, sized so the place and its surroundings are recognisable without dominating the page. The pin marks the place; a finished trip with a recorded route draws the route instead and fits it in view. Two controls sit in the map's corner: **Expand**, which opens the full-screen map, and **Directions**, which opens the place in the user's maps app. The place's name and region sit below the map. For an upcoming trip, **Save for offline** sits on its own row under the name; once the map is saved, that row reads **Available offline**.

The preview can be panned and zoomed in place for a quick look around.

## Full-screen map

The full-screen map shows the same place or route edge to edge.

- Pan, pinch to zoom and rotate freely.
- **Recentre** brings the place or route back into view after exploring.
- **Map style** switches between the map and satellite imagery.
- **Current location** shows where the user is relative to the place.
- **Directions** opens the place in the user's maps app.
- A close button, or the usual back gesture, returns to the trip page.

## What the user controls

- The trip's name, place, trail, dates, pack and notes, all from the trip form.
- The map style in the full-screen view.
- Whether to open the place in their maps app.

## What this feature does not do

- It does not support more than one place per trip, or plan a route between places.
- It does not draw a planned route before the trip; only a recorded route from a finished trip appears.
- It does not offer turn-by-turn navigation. Directions hand off to the user's maps app.
- It does not let the user drop or drag pins on the trip page or the full-screen map; the place is changed only from the trip form.
