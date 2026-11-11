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
    createFirstNameInput: 'auth:create-first-name-input',
    createLastNameInput: 'auth:create-last-name-input',
    createNameContinueBtn: 'auth:create-name-continue',
    createEmailInput: 'auth:create-email-input',
    createPasswordInput: 'auth:create-password-input',
    createConfirmPasswordInput: 'auth:create-confirm-password-input',
    createCredentialsSubmitBtn: 'auth:create-credentials-submit',
    forgotPasswordEmailInput: 'auth:forgot-password-email-input',
    forgotPasswordSubmitBtn: 'auth:forgot-password-submit',
    otpScreen: 'auth:otp-screen',
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

  // ── Pack templates ────────────────────────────────────────────────────────
  packTemplates: Object.freeze({
    createOptionsBtn: 'pack-templates:create-options',
    createFromScratchBtn: 'pack-templates:create-from-scratch',
    importOnlineContentBtn: 'pack-templates:import-online-content',
    addManuallyBtn: 'pack-templates:add-manually',
    scanPhotoBtn: 'pack-templates:scan-photo',
    addFromCatalogBtn: 'pack-templates:add-from-catalog',
    nameInput: 'pack-templates:name-input',
    descriptionInput: 'pack-templates:description-input',
    categoryInput: 'pack-templates:category-input',
    isAppTemplateSwitch: 'pack-templates:is-app-template-switch',
    weightInput: 'pack-templates:weight-input',
    quantityInput: 'pack-templates:quantity-input',
    consumableSwitch: 'pack-templates:consumable-switch',
    wornSwitch: 'pack-templates:worn-switch',
    imageButton: 'pack-templates:image-button',
    notesInput: 'pack-templates:notes-input',
    submitBtn: 'pack-templates:submit',
    useTemplateBtn: 'pack-templates:use-template',
    addItemBtn: 'pack-templates:add-item',
    templateCard: (id: string | number) => `pack-templates:template-card-${id}`,
    itemCard: (id: string | number) => `pack-templates:item-card-${id}`,
    allTab: 'pack-templates:tab-all',
    wornTab: 'pack-templates:tab-worn',
    consumableTab: 'pack-templates:tab-consumable',
    itemCardActionsBtn: (id: string | number) => `pack-templates:item-actions-${id}`,
    itemDetailEditBtn: 'pack-templates:item-detail-edit',
    itemDetailDeleteBtn: 'pack-templates:item-detail-delete',
    detailEditBtn: 'pack-templates:detail-edit',
    detailDeleteBtn: 'pack-templates:detail-delete',
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
    locationSearchInput: 'trips:location-search-input',
    locationSearchBtn: 'trips:location-search-button',
    locationConfirmBtn: 'trips:location-confirm-button',
  }),

  // ── Catalog ───────────────────────────────────────────────────────────────
  catalog: Object.freeze({
    searchBtn: 'catalog:search-btn',
    searchInput: 'catalog:search-input',
    addToPackBtn: 'add-to-pack-button', // keep Maestro value
    viewRetailerBtn: 'view-retailer-button', // keep Maestro value
    item: (id: string | number) => `catalog:item-${id}`,
    detailTitle: 'catalog:detail-title',
    detailWeight: 'catalog:detail-weight',
    packSelectionSearchInput: 'catalog:pack-selection-search-input',
    packSelectionItem: (id: string | number) => `catalog:pack-selection-item-${id}`,
    selectedPackName: 'catalog:selected-pack-name',
    quantityInput: 'catalog:quantity-input',
    notesInput: 'catalog:notes-input',
    categoryInput: 'catalog:category-input',
    addDetailsSubmitBtn: 'catalog:add-details-submit',
  }),

  // ── Feed ──────────────────────────────────────────────────────────────────
  feed: Object.freeze({
    createBtn: 'feed:create-post',
    galleryBtn: 'feed:gallery-button',
    cameraBtn: 'feed:camera-button',
    captionInput: 'feed:caption-input',
    photoRemoveBtn: (index: number) => `feed:photo-remove-${index}`,
    submitBtn: 'feed:submit',
    postLikeBtn: (id: string | number) => `feed:post-like-${id}`,
    postDeleteBtn: (id: string | number) => `feed:post-delete-${id}`,
    commentInput: 'feed:comment-input',
    commentSubmitBtn: 'feed:comment-submit',
    commentLikeBtn: (id: string | number) => `feed:comment-like-${id}`,
    commentDeleteBtn: (id: string | number) => `feed:comment-delete-${id}`,
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
    savedSearchInput: 'weather:saved-search-input',
    addLocationBtn: 'weather:add-location',
    searchResult: (id: string | number) => `weather:search-result-${id}`,
    searchResultViewBtn: (id: string | number) => `weather:search-result-view-${id}`,
    searchResultAddBtn: (id: string | number) => `weather:search-result-add-${id}`,
    location: (id: string | number) => `weather:location-${id}`,
  }),
});
