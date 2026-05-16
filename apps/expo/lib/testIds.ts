/**
 * Centralized test-ID registry — single source of truth for every `testID`
 * used in components, Playwright web specs, and Maestro iOS flows.
 *
 * `testIds` is the primary API, organised by domain.
 * - Static IDs: plain string values.
 * - Dynamic IDs: factory functions (`testIds.packs.listItem(id)`) so callers
 *   never hand-interpolate strings.
 *
 * `TestIds` is a backward-compat alias that maps the old PascalCase enum keys
 * to the same underlying strings. Maestro flows reference these values via
 * `id:` selectors — keep the string values stable.
 *
 * Usage in components:
 *   import { testIds } from 'expo-app/lib/testIds';
 *   <TextInput testID={testIds.packs.nameInput} />
 *
 * Usage in Playwright specs:
 *   import { testIds } from '../../../lib/testIds';
 *   page.getByTestId(testIds.packs.nameInput)
 */
export const testIds = Object.freeze({
  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: Object.freeze({
    signInEmailBtn: 'sign-in-email-button', // keep Maestro value
    emailInput: 'email-input',
    passwordInput: 'password-input',
    continueBtn: 'continue-button',
    signOutBtn: 'sign-out-button', // keep Maestro value
  }),

  // ── Packs ─────────────────────────────────────────────────────────────────
  packs: Object.freeze({
    createBtn: 'create-pack-button', // keep Maestro value
    cancelBtn: 'cancel-pack-form-button', // keep Maestro value
    nameInput: 'packs:name-input',
    descriptionInput: 'packs:description-input',
    submitBtn: 'submit-pack-button', // keep Maestro value
    deleteBtn: 'packs:delete',
    editBtn: 'packs:edit',
    addItemBtn: 'add-item-button', // keep Maestro value
    askAIBtn: 'ask-ai-button', // keep Maestro value
    moreActionsBtn: 'pack-more-actions', // keep Maestro value
    listItem: (id: string | number) => `packs:list-item-${id}`,
  }),

  // ── Pack items ────────────────────────────────────────────────────────────
  items: Object.freeze({
    addManuallyOption: 'add-manually-option', // keep Maestro value
    scanPhotoOption: 'scan-from-photo-option', // keep Maestro value
    addFromCatalogOption: 'add-from-catalog-option', // keep Maestro value
    nameInput: 'items:name-input',
    descriptionInput: 'items:description-input',
    weightInput: 'items:weight-input',
    weightUnitControl: 'items:weight-unit',
    quantityInput: 'items:quantity-input',
    categoryInput: 'items:category-input',
    submitBtn: 'items:submit',
    deleteBtn: 'items:delete',
    editBtn: 'items:edit',
    moreActionsBtn: (id: string | number) => `items:more-actions-${id}`,
    card: (id: string | number) => `items:card-${id}`,
    catalogCard: (id: string | number) => `catalog-item-card-${id}`, // keep existing value
    catalogConfirmAddBtn: 'items:catalog-confirm-add',
    catalogClearBtn: 'items:catalog-clear',
  }),

  // ── Trips ─────────────────────────────────────────────────────────────────
  trips: Object.freeze({
    createBtn: 'create-trip-button', // keep Maestro value
    cancelBtn: 'cancel-trip-form-button', // keep Maestro value
    nameInput: 'trips:name-input',
    descriptionInput: 'trips:description-input',
    submitBtn: 'submit-trip-button', // keep Maestro value
    deleteBtn: 'trips:delete',
    editBtn: 'trips:edit',
    listItem: (id: string | number) => `trips:list-item-${id}`,
    startDateInput: 'trips:start-date-input',
    endDateInput: 'trips:end-date-input',
  }),

  // ── Catalog ───────────────────────────────────────────────────────────────
  catalog: Object.freeze({
    searchBtn: 'catalog:search-btn',
    searchInput: 'catalog:search-input',
    addToPackBtn: 'add-to-pack-button', // keep Maestro value
    viewRetailerBtn: 'view-retailer-button', // keep Maestro value
    item: (id: string | number) => `catalog:item-${id}`,
  }),

  // ── Profile ───────────────────────────────────────────────────────────────
  profile: Object.freeze({
    signOutBtn: 'sign-out-button', // keep Maestro value
    firstNameInput: 'profile:first-name-input',
    lastNameInput: 'profile:last-name-input',
    usernameInput: 'profile:username-input',
    saveBtn: 'profile:save',
    nameEditBtn: 'profile:name-edit',
  }),

  // ── Settings ──────────────────────────────────────────────────────────────
  settings: Object.freeze({
    aiModelsSection: 'settings:ai-models',
    dangerZone: 'settings:danger-zone',
    deleteAccountBtn: 'settings:delete-account',
  }),

  // ── Weather ───────────────────────────────────────────────────────────────
  weather: Object.freeze({
    searchInput: 'weather:search-input',
    addLocationBtn: 'weather:add-location',
    location: (id: string | number) => `weather:location-${id}`,
  }),
});
