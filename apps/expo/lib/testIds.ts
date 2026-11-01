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
    emailInputContainer: 'email-input-container',
    passwordInput: 'password-input',
    passwordInputContainer: 'password-input-container',
    continueBtn: 'continue-button',
    signOutBtn: 'sign-out-button', // keep Maestro value
    showPasswordCheckbox: 'auth:show-password-checkbox',
  }),

  // ── Messages ──────────────────────────────────────────────────────────────
  messages: Object.freeze({
    selectConversationCheckbox: (id: string | number) => `messages:select-conversation-${id}`,
  }),

  // ── Packs ─────────────────────────────────────────────────────────────────
  packs: Object.freeze({
    createBtn: 'create-pack-button', // keep Maestro value
    emptyCreateBtn: 'create-pack-empty-button',
    cancelBtn: 'cancel-pack-form-button', // keep Maestro value
    nameInput: 'packs:name-input',
    nameInputContainer: 'packs:name-input-container',
    descriptionInput: 'packs:description-input',
    descriptionInputContainer: 'packs:description-input-container',
    submitBtn: 'submit-pack-button', // keep Maestro value
    deleteBtn: 'packs:delete',
    deleteConfirmBtn: 'packs:delete-confirm',
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
    nameInputContainer: 'items:name-input-container',
    descriptionInput: 'items:description-input',
    descriptionInputContainer: 'items:description-input-container',
    weightInput: 'items:weight-input',
    weightInputContainer: 'items:weight-input-container',
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
  tripStats: Object.freeze({
    screen: 'trip-stats:screen',
    profileRow: 'trip-stats:profile-row',
    dashboardTile: 'trip-stats:dashboard-tile',
    emptyPlanTripBtn: 'trip-stats:empty-plan-trip',
    addGoalBtn: 'trip-stats:add-goal',
    setGoalBtn: 'trip-stats:set-goal',
    goalRow: (id: string) => `trip-stats:goal-${id}`,
    pastGoalsToggle: 'trip-stats:past-goals',
    monthsMetric: (metric: string) => `trip-stats:months-${metric}`,
    scopeYear: 'trip-stats:scope-year',
    scopeActivity: 'trip-stats:scope-activity',
    scopeClear: 'trip-stats:scope-clear',
    scopeEmpty: 'trip-stats:scope-empty',
    scopeEmptyShowAllBtn: 'trip-stats:scope-show-all',
    activityRow: (activity: string) => `trip-stats:activity-${activity}`,
    whyAwayBtn: 'trip-stats:why-away',
    menu: 'trip-stats:menu',
    reviewBanner: 'trip-stats:review-banner',
    reviewPager: 'trip-stats:review-pager',
    reviewCloseBtn: 'trip-stats:review-close',
    reviewShareBtn: 'trip-stats:review-share',
    shareTotalsBtn: 'trip-stats:share-totals',
    shareYearBtn: 'trip-stats:share-year',
    shareMapBtn: 'trip-stats:share-map',
    shareParksBtn: 'trip-stats:share-parks',
    shareScreen: 'trip-stats:share-screen',
    shareFormat: (format: string) => `trip-stats:share-format-${format}`,
    shareNamesToggle: 'trip-stats:share-names',
    shareZoomToggle: 'trip-stats:share-zoom',
    shareSendBtn: 'trip-stats:share-send',
    placesCard: 'trip-stats:places-card',
    placeRow: (code: string) => `trip-stats:place-${code}`,
    placeDetailMap: 'trip-stats:place-detail-map',
    map: 'trip-stats:map',
    mapShowAllBtn: 'trip-stats:map-show-all',
    mapTripRow: (id: string) => `trip-stats:map-trip-${id}`,
    landscapesCard: 'trip-stats:landscapes-card',
    landscapeRow: (landscape: string) => `trip-stats:landscape-${landscape}`,
    landscapeTripMenu: (id: string) => `trip-stats:landscape-trip-menu-${id}`,
    logLandscape: 'trip-stats:log-landscape',
    idleGearCard: 'trip-stats:idle-gear-card',
    idleGearRow: (id: string) => `trip-stats:idle-gear-${id}`,
    parksCard: 'trip-stats:parks-card',
    peaksCard: 'trip-stats:peaks-card',
    parkRow: (code: string) => `trip-stats:park-${code}`,
    parkSearchInput: 'trip-stats:park-search',
    addPastVisitBtn: 'trip-stats:add-past-visit',
    removeVisitBtn: (id: string) => `trip-stats:remove-visit-${id}`,
    addSummitFab: 'trip-stats:add-summit',
    choosePeakBtn: 'trip-stats:choose-peak',
    peakRow: (key: string) => `trip-stats:peak-${key}`,
    peakSearchInput: 'trip-stats:peak-search',
    peakByHandBtn: 'trip-stats:peak-by-hand',
    peakNameInput: 'trip-stats:peak-name',
    peakElevationInput: 'trip-stats:peak-elevation',
    dialogCloseBtn: 'trip-stats:dialog-close',
    dialogSaveBtn: 'trip-stats:dialog-save',
    goalKind: (kind: string) => `trip-stats:goal-kind-${kind}`,
    goalMetric: (metric: string) => `trip-stats:goal-metric-${metric}`,
    goalTargetInput: 'trip-stats:goal-target',
    goalNameInput: 'trip-stats:goal-name',
    goalStartDate: 'trip-stats:goal-start',
    goalEndDate: 'trip-stats:goal-end',
    deleteGoalBtn: 'trip-stats:delete-goal',
    goalTrail: (code: string) => `trip-stats:goal-trail-${code}`,
    goalAddPeakBtn: 'trip-stats:goal-add-peak',
    goalRemovePeak: (key: string) => `trip-stats:goal-remove-peak-${key}`,
    goalEveryParkToggle: 'trip-stats:goal-every-park',
    goalChooseParksBtn: 'trip-stats:goal-choose-parks',
    goalFinishToggle: 'trip-stats:goal-finish-toggle',
    goalFinishDate: 'trip-stats:goal-finish-date',
    parkSelectRow: (code: string) => `trip-stats:park-select-${code}`,
    parkSelectClearBtn: 'trip-stats:park-select-clear',
    longTrailsCard: 'trip-stats:long-trails-card',
    followTrailBtn: 'trip-stats:follow-trail',
    longTrailRow: (code: string) => `trip-stats:trail-${code}`,
    longTrailMap: 'trip-stats:long-trail-map',
    longTrailFollowBtn: 'trip-stats:long-trail-follow',
    longTrailMenu: 'trip-stats:long-trail-menu',
    longTrailTripRow: (id: string) => `trip-stats:long-trail-trip-${id}`,
    logSection: 'trip-stats:log-section',
    logTripBtn: 'trip-stats:log-trip',
    countInStatsToggle: 'trip-stats:count-in-stats',
    notInStatsLabel: (id: string) => `trip-stats:not-in-stats-${id}`,
    logActivity: (activity: string) => `trip-stats:log-activity-${activity}`,
    logDistanceInput: 'trip-stats:log-distance',
    logTrailDistance: (kind: string) => `trip-stats:log-trail-distance-${kind}`,
    drawRouteBtn: 'trip-stats:draw-route',
    drawRouteMap: 'trip-stats:draw-route-map',
    drawRouteDistance: 'trip-stats:draw-route-distance',
    drawRouteUndo: 'trip-stats:draw-route-undo',
    drawRouteOutAndBack: 'trip-stats:draw-route-out-and-back',
    drawRouteClear: 'trip-stats:draw-route-clear',
    logElevationInput: 'trip-stats:log-elevation',
    importGpxBtn: 'trip-stats:import-gpx',
    removeRouteBtn: 'trip-stats:remove-route',
    logAddSummitBtn: 'trip-stats:log-add-summit',
    logRemoveSummit: (index: number) => `trip-stats:log-remove-summit-${index}`,
    logAddTrailBtn: 'trip-stats:log-add-trail',
    logRemoveTrail: (index: number) => `trip-stats:log-remove-trail-${index}`,
    trailsCard: 'trip-stats:trails-card',
    walkedTrailRow: (id: string) => `trip-stats:walked-trail-${id}`,
    walkedTrailMap: 'trip-stats:walked-trail-map',
    walkedTrailTripRow: (id: string) => `trip-stats:walked-trail-trip-${id}`,
    trailSearchInput: 'trip-stats:trail-search',
    trailOption: (id: string) => `trip-stats:trail-option-${id}`,
  }),
  trips: Object.freeze({
    createBtn: 'create-trip-button', // keep Maestro value
    emptyCreateBtn: 'create-trip-empty-button',
    cancelBtn: 'cancel-trip-form-button', // keep Maestro value
    trailButton: 'trip-trail-button',
    nameInput: 'trips:name-input',
    nameInputContainer: 'trips:name-input-container',
    descriptionInput: 'trips:description-input',
    descriptionInputContainer: 'trips:description-input-container',
    submitBtn: 'submit-trip-button', // keep Maestro value
    deleteBtn: 'trips:delete',
    deleteConfirmBtn: 'trips:delete-confirm',
    editBtn: 'trips:edit',
    inlineDeleteBtn: 'trips:inline-delete',
    inlineEditBtn: 'trips:inline-edit',
    datesSection: 'trips:dates-section',
    startDateBtn: 'trips:start-date-btn',
    endDateBtn: 'trips:end-date-btn',
    startDateInput: 'trips:start-date-input',
    endDateInput: 'trips:end-date-input',
    listItem: (id: string | number) => `trips:list-item-${id}`,
    readinessCard: 'trips:readiness-card',
    readinessPacking: 'trips:readiness-packing',
    readinessLinkPack: 'trips:readiness-link-pack',
    readinessAllPacked: 'trips:readiness-all-packed',
    readinessForecast: 'trips:readiness-forecast',
    checklistSection: 'trips:checklist-section',
    checklistAddField: 'trips:checklist-add-field',
    checklistItem: (id: string) => `trips:checklist-item-${id}`,
    checklistSuggestion: (title: string) => `trips:checklist-suggestion-${title}`,
    remindersToggle: 'trips:reminders-toggle',
    startPackingBtn: 'trips:start-packing',
    packAllPacked: 'trips:pack-all-packed',
  }),

  // ── Catalog ───────────────────────────────────────────────────────────────
  catalog: Object.freeze({
    searchBtn: 'catalog:search-btn',
    searchInput: 'catalog:search-input',
    totalItemsCount: 'catalog:total-items-count',
    addToPackBtn: 'add-to-pack-button', // keep Maestro value
    packSelectionScreen: 'catalog:pack-selection-screen',
    packSelectionSearch: 'catalog:pack-selection-search',
    viewRetailerBtn: 'view-retailer-button', // keep Maestro value
    packOption: (id: string | number) => `catalog:pack-option-${id}`,
    item: (id: string | number) => `catalog:item-${id}`,
    addDetailsCategoryInput: 'catalog:add-details-category-input',
    addDetailsCategoryChip: (category: string) => `catalog:add-details-category-chip-${category}`,
    addDetailsQuantityInput: 'catalog:add-details-quantity-input',
  }),

  // ── Guides ────────────────────────────────────────────────────────────────
  guides: Object.freeze({
    card: (id: string | number) => `guides:card-${id}`,
    categoryChip: (category: string) => `guides:category-chip-${category}`,
    relatedCard: (id: string | number) => `guides:related-card-${id}`,
    messageAction: 'guides:message-action',
  }),

  // ── Pack templates ────────────────────────────────────────────────────────
  packTemplates: Object.freeze({
    dashboardTile: 'dashboard-tile-pack-templates',
    card: (id: string | number) => `pack-templates:card-${id}`,
    officialShelf: 'pack-templates:official-shelf',
    officialSeeAll: 'pack-templates:official-see-all',
    officialRow: (id: string) => `pack-templates:official-row-${id}`,
    mineEmpty: 'pack-templates:mine-empty',
    detailOfficialBadge: 'pack-templates:detail-official-badge',
    detailApplyBtn: 'pack-templates:detail-apply',
    applyNewPack: 'pack-templates:apply-new-pack',
    applyPackRow: (id: string) => `pack-templates:apply-pack-${id}`,
    applyError: 'pack-templates:apply-error',
    newPackName: 'pack-templates:new-pack-name',
    newPackCreate: 'pack-templates:new-pack-create',
    newPackError: 'pack-templates:new-pack-error',
  }),

  // ── Profile ───────────────────────────────────────────────────────────────
  profile: Object.freeze({
    signOutBtn: 'sign-out-button', // keep Maestro value
    firstNameInput: 'profile:first-name-input',
    lastNameInput: 'profile:last-name-input',
    usernameInput: 'profile:username-input',
    saveBtn: 'profile:save',
    nameEditBtn: 'profile:name-edit',
    settingsBtn: 'profile:settings-btn',
  }),

  // ── Settings ──────────────────────────────────────────────────────────────
  settings: Object.freeze({
    aiModelsSection: 'settings:ai-models',
    dangerZone: 'settings:danger-zone',
    deleteAccountBtn: 'settings:delete-account',
    weightUnitControl: 'settings:weight-unit',
    temperatureUnitControl: 'settings:temperature-unit',
    speedUnitControl: 'settings:speed-unit',
    tripRemindersToggle: 'settings:trip-reminders',
    upgradeToProBtn: 'settings:upgrade-to-pro',
    manageSubscriptionBtn: 'settings:manage-subscription',
    restorePurchasesBtn: 'settings:restore-purchases',
  }),

  // ── Paywall ───────────────────────────────────────────────────────────────
  paywall: Object.freeze({
    headline: 'paywall:headline',
    ctaBtn: 'paywall:cta',
    restoreBtn: 'paywall:restore',
    closeBtn: 'paywall:close',
    planRow: (identifier: string) => `paywall:plan-${identifier}`,
  }),

  // ── AI Chat ───────────────────────────────────────────────────────────────
  aiChat: Object.freeze({
    input: 'ai-chat:input',
    sendBtn: 'ai-chat:send',
    stopBtn: 'ai-chat:stop',
    assistantMessage: (id: string | number) => `ai-chat:assistant-message-${id}`,
  }),

  // ── Weather ───────────────────────────────────────────────────────────────
  weather: Object.freeze({
    searchInput: 'weather:search-input',
    addLocationBtn: 'weather:add-location',
    location: (id: string | number) => `weather:location-${id}`,
    newAlertDot: (id: string | number) => `weather:new-alert-${id}`,
    moreMenu: 'weather:more-menu',
    watchListMenuItem: 'weather:menu-watch-list',
    snackbar: 'weather:snackbar',
    attributionLegal: 'weather:attribution-legal',
    alertSection: 'weather:alert-section',
    watchCta: 'weather:watch-cta',
    watchToggle: 'weather:watch-toggle',
    saveLocationBtn: 'weather:save-location',
    watchListAddBtn: 'weather:watch-list-add',
    watchedLocation: (id: string | number) => `weather:watched-${id}`,
    removeWatched: (id: string | number) => `weather:remove-watched-${id}`,
    homeNewAlertDot: 'weather:home-new-alert',
  }),

  // ── Trail conditions ──────────────────────────────────────────────────────
  trailConditions: Object.freeze({
    submitReportBtn: 'trail-conditions:submit-report',
    searchInput: 'trail-conditions:search-input',
    reportRow: (id: string) => `trail-conditions:report-${id}`,
    deleteReportBtn: (id: string) => `trail-conditions:delete-report-${id}`,
    emptyStateSubmitBtn: 'trail-conditions:empty-submit-report',
    // Submit form
    trailNameInput: 'trail-conditions:trail-name-input',
    trailRegionInput: 'trail-conditions:trail-region-input',
    notesInput: 'trail-conditions:notes-input',
    conditionOption: (condition: string) => `trail-conditions:condition-${condition}`,
    surfaceOption: (surface: string) => `trail-conditions:surface-${surface}`,
    // Hazards are a fixed, space-separated vocabulary ("downed trees"), so splitting on the
    // space is enough to slug them — no regex needed.
    hazardChip: (hazard: string) => `trail-conditions:hazard-${hazard.split(' ').join('-')}`,
    formSubmitBtn: 'trail-conditions:form-submit',
    formCancelBtn: 'trail-conditions:form-cancel',
    chooseTrailBtn: 'trail-conditions:choose-trail',
    addPhotosBtn: 'trail-conditions:add-photos',
    removePhotoBtn: (index: number) => `trail-conditions:remove-photo-${index}`,
    // Trail picker and pin drop
    trailSearchInput: 'trail-conditions:trail-search-input',
    trailPickerRow: (trailId: string) => `trail-conditions:trail-${trailId}`,
    dropPinBtn: 'trail-conditions:drop-pin',
    pinMap: 'trail-conditions:pin-map',
    pinLabelInput: 'trail-conditions:pin-label',
    confirmPinBtn: 'trail-conditions:confirm-pin',
    // Report detail, trail page and moderation
    reportMenuBtn: 'trail-conditions:report-menu',
    flagReportBtn: 'trail-conditions:flag-report',
    blockAuthorBtn: 'trail-conditions:block-author',
    trailPageLink: 'trail-conditions:trail-page-link',
    trailPageWriteReportBtn: 'trail-conditions:trail-page-write-report',
    trailPagePlanTripBtn: 'trail-conditions:trail-page-plan-trip',
    // Trip section
    tripSection: 'trail-conditions:trip-section',
    tripSectionWriteReportBtn: 'trail-conditions:trip-section-write-report',
  }),

  // ── Wildlife ──────────────────────────────────────────────────────────────
  wildlife: Object.freeze({
    addPhotoBtn: 'wildlife:add-photo',
    identifyBtn: 'wildlife:identify',
    resultsList: 'wildlife:results',
    resultCard: (speciesId: string) => `wildlife:result-${speciesId}`,
    outcomeMessage: 'wildlife:outcome-message',
  }),
});
