/**
 * Stable testID identifiers used by Maestro E2E flows.
 *
 * On iOS these map to `accessibilityIdentifier` (set via React Native `testID`).
 * On Android they map to the `resource-id` content descriptor.
 *
 * Keep the string values in sync with the `id:` selectors in `.maestro/flows/`.
 */
export enum TestIds {
  // Auth screens
  SignInEmailButton = 'sign-in-email-button',
  EmailInput = 'email-input',
  PasswordInput = 'password-input',
  ContinueButton = 'continue-button',

  // Trips
  CreateTripButton = 'create-trip-button',
  SubmitTripButton = 'submit-trip-button',

  // Packs
  CreatePackButton = 'create-pack-button',
  SubmitPackButton = 'submit-pack-button',

  // Pack detail
  AskAIButton = 'ask-ai-button',
  AddItemButton = 'add-item-button',
  PackMoreActions = 'pack-more-actions',

  // Add item modal
  AddManuallyOption = 'add-manually-option',
  ScanFromPhotoOption = 'scan-from-photo-option',
  AddFromCatalogOption = 'add-from-catalog-option',

  // Profile
  SignOutButton = 'sign-out-button',

  // Catalog item detail
  AddToPackButton = 'add-to-pack-button',
  ViewRetailerButton = 'view-retailer-button',
}
