# Trip location and map

Lets a user set where a trip happens and see it on a map, from a glance on the trip page to a full-screen view they can explore.

## The model in one paragraph

Every trip can have one place: a trailhead, a park, a town. The user picks it while creating or editing the trip, either by searching for it or by moving the map until the pin sits where they want. Once set, the trip page shows the place as a compact map preview with its name underneath. Tapping the preview opens a full-screen map where the user can pan, zoom and switch map styles, then hand the place off to their maps app for directions. A finished trip with a recorded route shows that route on both the preview and the full-screen map.

## Picking the place

Choosing **Location** in the trip form opens a full-screen picker. A search field sits at the top and the map fills the rest of the screen, with a pin fixed at its centre.

- **Search**: typing shows matching places as a list of results, each with its name and the region it belongs to. Tapping a result moves the map there and closes the list.
- **Move the map**: dragging the map moves the place under the fixed pin. The name of the place under the pin appears in a panel at the bottom of the screen and updates when the map comes to rest.
- **Current location**: a button on the map centres it on where the user is right now.
- **Confirm**: the bottom panel shows the chosen place's name and region with a single **Use this location** button. The picker closes and the trip form shows the place.

A trip that already has a place opens the picker centred on it.

## On the trip page

The trip page shows the place as a map preview with rounded corners, sized so the place and its surroundings are recognisable without dominating the page. The pin marks the place; a finished trip with a recorded route draws the route instead and fits it in view. The place's name and region sit below the map, with **Directions** and **Weather** as actions alongside.

The preview is for looking, not exploring: it does not pan or zoom by itself. Tapping anywhere on it, or its expand button in the corner, opens the full-screen map.

## Full-screen map

The full-screen map shows the same place or route edge to edge.

- Pan, pinch to zoom and rotate freely.
- **Recentre** brings the place or route back into view after exploring.
- **Map style** switches between the standard map, satellite and terrain.
- **Current location** shows where the user is relative to the place.
- **Directions** opens the place in the user's maps app.
- A close button, or the usual back gesture, returns to the trip page.

## What the user controls

- The trip's place, set and changed from the trip form.
- The map style in the full-screen view.
- Whether to open the place in their maps app.

## What this feature does not do

- It does not support more than one place per trip, or plan a route between places.
- It does not draw a planned route before the trip; only a recorded route from a finished trip appears.
- It does not offer turn-by-turn navigation. Directions hand off to the user's maps app.
- It does not let the user drop or drag pins on the trip page or the full-screen map; the place is changed only from the trip form.
