# Pack Duplication Feature - UI Behavior

## Feature Overview
Users can now duplicate packs from "All Packs" into "My Packs" with a single button press.

## UI Changes

### PackCard Component
- **My Packs view**: Shows delete button (trash icon) for owned packs
- **All Packs view**: Shows duplicate button (file-copy icon) for non-owned packs
- **Duplicate button states**:
  - Normal: Shows file-copy icon
  - Loading: Shows ActivityIndicator spinner
  - Confirmation: Shows "Duplicate pack?" dialog

### PackListScreen
- **My Packs tab**: `showDuplicateButton={false}` - only shows delete buttons
- **All Packs tab**: `showDuplicateButton={true}` - only shows duplicate buttons

## User Flow
1. User navigates to Packs screen
2. User taps "All Packs" tab to see public packs from other users
3. User sees duplicate button (file-copy icon) on each pack card
4. User taps duplicate button
5. System shows confirmation dialog: "Duplicate pack? This will create a copy of this pack in your collection."
6. User taps "Duplicate"
7. Button shows loading spinner while API fetches pack details
8. System creates new pack in user's collection with:
   - Name: "[Original Name] (Copy)"
   - Privacy: Private (default)
   - Owner: Current user
   - Items: All items from original pack
9. User switches to "My Packs" tab to see the duplicated pack

## Technical Implementation
- `useCreatePackFromPack` hook handles pack creation with items
- `useDuplicatePack` hook fetches API data and creates local copy
- React Query manages the async operation and error handling
- Legend State stores sync the new pack to local storage and API
- Pack weight calculations are automatically recalculated

## Error Handling
- Network errors during pack fetch are caught and displayed
- Loading states prevent multiple duplicate attempts
- Confirmation dialog prevents accidental duplication