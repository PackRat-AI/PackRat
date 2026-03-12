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
}
