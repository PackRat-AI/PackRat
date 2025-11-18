# i18n Migration - Scope of Work (SoW)

## Executive Summary

This document outlines the complete scope of work to migrate all hardcoded English strings in the PackRat Expo application to use the i18n (internationalization) system. The infrastructure is already in place; this SoW focuses on migrating existing components.

### Current Status
- ✅ **Infrastructure**: Complete (expo-localization + i18n-js)
- ✅ **Base translations**: 150+ keys in `en.json`
- ✅ **Documentation**: 8 comprehensive guides
- ✅ **Example implementations**: 7 files migrated
- 🔄 **Remaining work**: 40 files with 240+ hardcoded strings

## Scope Analysis

### Files Scanned
- **Total TypeScript files**: 221 TSX files in apps/expo
- **Files with hardcoded strings**: 40 files
- **Strings identified**: 240+ user-facing strings
- **Already migrated**: 7 files (examples)
- **Remaining**: 33 files to migrate

### Breakdown by Directory

#### 1. Components (`/components`)
**Files**: 5
**Estimated strings**: ~20
```
- BackButton.tsx (1 string)
- CategoriesFilter.tsx (2 strings)
- ai-chatHeader.tsx (2 strings)
- initial/ErrorBoundary.tsx (3 strings)
- initial/ItemCard.tsx (3 strings)
```

#### 2. Screens (`/screens`)
**Files**: 1 (ErrorScreen.tsx already partially migrated)
**Estimated strings**: ~2

#### 3. App Routes (`/app`)
**Files**: 27
**Estimated strings**: ~150

##### Main Tabs
- `(app)/(tabs)/(home)/index.tsx` - Dashboard (4 strings)
- `(app)/(tabs)/profile/name.tsx` - Profile name (1 string)
- `(app)/(tabs)/profile/notifications.tsx` - Notifications (3 strings)
- `(app)/(tabs)/profile/username.tsx` - Username (3 strings)
- `(app)/(tabs)/sqlite-debug/index.tsx` - Debug screen (14 strings)

##### Pack Management
- `current-pack/[id].tsx` - Current pack view (~15 strings)
- `pack/[id]/index.tsx` - Pack details
- `pack/[id]/edit.tsx` - Pack editing
- `pack/[id]/feed.tsx` - Pack feed
- `pack/new.tsx` - New pack creation

##### Item Management
- `item/[id]/index.tsx` - Item details
- `item/[id]/edit.tsx` - Item editing
- `templateItem/[id]/index.tsx` - Template item
- `templateItem/[id]/edit.tsx` - Template editing
- `templateItem/new.tsx` - New template

##### Other Screens
- `demo/index.tsx` - Demo screen (~20 strings)
- `ai-chat.tsx` - AI chat interface
- `gear-inventory.tsx` - Gear inventory
- `season-suggestions.tsx` - Season suggestions
- `shopping-list.tsx` - Shopping list
- `trip/[id]/index.tsx` - Trip details
- `trip/[id]/edit.tsx` - Trip editing

#### 4. Features (`/features`)
**Files**: 10+
**Estimated strings**: ~70

##### By Feature Module
- **AI Features** (`features/ai/`) - 3-4 files
- **Auth Features** (`features/auth/`) - 2-3 files
- **Pack Management** (`features/packs/`) - 5+ files
- **Catalog** (`features/catalog/`) - 2-3 files
- **Profile** (`features/profile/`) - 2-3 files
- **Weather** (`features/weather/`) - 1-2 files
- **Trips** (`features/trips/`) - 2-3 files

## Migration Phases

### Phase 1: Core Components (Priority: High)
**Duration**: 2-3 hours
**Files**: 5 component files

**Tasks**:
1. Migrate BackButton.tsx
2. Migrate CategoriesFilter.tsx
3. Migrate ai-chatHeader.tsx
4. Migrate ErrorBoundary.tsx
5. Migrate ItemCard.tsx

**New translation keys needed**: ~15-20

### Phase 2: Main App Screens (Priority: High)
**Duration**: 4-5 hours
**Files**: Dashboard, Profile screens, Settings

**Tasks**:
1. Migrate dashboard (home/index.tsx)
2. Migrate profile screens (name, username, notifications)
3. Update profile-related translations

**New translation keys needed**: ~25-30

### Phase 3: Pack Management (Priority: Medium)
**Duration**: 5-6 hours
**Files**: Pack viewing, editing, creation screens

**Tasks**:
1. Migrate pack display components
2. Migrate pack editing screens
3. Migrate pack creation flow
4. Update pack-related translations

**New translation keys needed**: ~40-50

### Phase 4: Item & Template Management (Priority: Medium)
**Duration**: 4-5 hours
**Files**: Item and template CRUD operations

**Tasks**:
1. Migrate item detail screens
2. Migrate item editing screens
3. Migrate template screens
4. Update item/catalog translations

**New translation keys needed**: ~30-40

### Phase 5: Feature Modules (Priority: Medium)
**Duration**: 6-8 hours
**Files**: AI, Auth, Weather, Trips features

**Tasks**:
1. Migrate AI feature components
2. Migrate auth screens
3. Migrate weather components
4. Migrate trip management
5. Update feature-specific translations

**New translation keys needed**: ~50-70

### Phase 6: Auxiliary Screens (Priority: Low)
**Duration**: 3-4 hours
**Files**: Demo, Debug, Admin screens

**Tasks**:
1. Migrate demo screen
2. Migrate sqlite-debug screen
3. Migrate admin screens
4. Update auxiliary translations

**New translation keys needed**: ~20-30

### Phase 7: Testing & Validation (Priority: High)
**Duration**: 4-6 hours

**Tasks**:
1. Run extract-strings.js to verify all strings migrated
2. Test all screens manually
3. Verify no hardcoded strings remain
4. Test with different locales (if multi-language is added)
5. Update documentation with new translation keys
6. Code review and cleanup

## Translation Key Organization

### New Categories Needed

Based on the analysis, we'll need to add these categories to `en.json`:

```json
{
  // Existing categories...
  
  "demo": {
    "title": "Demo Screen",
    "noComponents": "No Components Installed",
    // ... more demo strings
  },
  
  "debug": {
    "title": "SQLite KV-Store Debug",
    "addEntry": "Add Entry",
    "editEntry": "Edit Entry: {{key}}",
    // ... more debug strings
  },
  
  "currentPack": {
    "title": "Current Pack",
    "totalWeight": "Total Weight",
    "baseWeight": "Base Weight",
    "categories": "Categories",
    "lastUpdated": "Last updated: {{time}}",
    // ... more pack strings
  },
  
  "itemCard": {
    "consumable": "Consumable",
    "worn": "Worn",
    "quantity": "Qty: {{quantity}}",
    // ... more item strings
  },
  
  "notifications": {
    "push": "Push Notifications",
    "email": "Email Notifications",
    // ... more notification strings
  },
  
  "search": {
    "noResults": "No matching tiles found",
    "tryDifferent": "Try different keywords or clear your search",
    "placeholder": "Search {{context}}",
    // ... more search strings
  }
}
```

## Effort Estimation

### Total Time Estimate
- **Phase 1 (Components)**: 2-3 hours
- **Phase 2 (Main Screens)**: 4-5 hours
- **Phase 3 (Packs)**: 5-6 hours
- **Phase 4 (Items)**: 4-5 hours
- **Phase 5 (Features)**: 6-8 hours
- **Phase 6 (Auxiliary)**: 3-4 hours
- **Phase 7 (Testing)**: 4-6 hours

**Total**: 28-37 hours (~4-5 working days)

### Complexity Factors
- **Low complexity**: Simple text replacements (40% of work)
- **Medium complexity**: Text with variables/interpolation (40% of work)
- **High complexity**: Dynamic text generation, conditional strings (20% of work)

## Risk Assessment

### Low Risk
- Infrastructure already in place
- Clear examples available
- Good documentation
- TypeScript support for type safety

### Medium Risk
- Large number of files to migrate
- Potential for missing edge cases
- Need to maintain functionality during migration
- Testing effort required

### Mitigation Strategies
1. **Incremental migration**: Migrate one module at a time
2. **Comprehensive testing**: Test each screen after migration
3. **Code review**: Review changes before committing
4. **Fallback mechanism**: useTranslation hook provides fallbacks
5. **Documentation updates**: Keep docs updated with new keys

## Success Criteria

### Definition of Done
- [ ] All 40 files with hardcoded strings migrated
- [ ] No hardcoded user-facing strings remain (verified by extract-strings.js)
- [ ] All new translation keys added to en.json
- [ ] All screens tested and functional
- [ ] Documentation updated with new translation keys
- [ ] Type definitions updated in types.ts
- [ ] Code review completed
- [ ] No regressions introduced

### Metrics
- **Coverage**: 100% of user-facing strings migrated
- **Test coverage**: All screens manually tested
- **Code quality**: No lint errors, follows existing patterns
- **Documentation**: All new keys documented

## Deliverables

1. **Migrated Components**: All 40 files updated to use i18n
2. **Updated Translations**: Complete en.json with all strings
3. **Updated Type Definitions**: types.ts with all new keys
4. **Test Results**: Manual testing verification
5. **Updated Documentation**: Migration completion report

## Resources Required

### Tools Already Available
- ✅ extract-strings.js (string detection)
- ✅ useTranslation hook
- ✅ Comprehensive documentation
- ✅ Example implementations

### Additional Resources Needed
- Developer time: 28-37 hours
- QA/Testing time: 4-6 hours
- Code review time: 2-3 hours

## Migration Checklist Template

For each file:
```
[ ] Run extract-strings.js to identify strings
[ ] Add new translation keys to en.json
[ ] Import useTranslation hook
[ ] Replace hardcoded strings with t() calls
[ ] Update types.ts if needed
[ ] Test the component/screen
[ ] Verify no hardcoded strings remain
[ ] Commit changes
```

## Next Steps

1. **Review this SoW** with the team
2. **Prioritize phases** based on business needs
3. **Assign resources** (developers, QA)
4. **Start with Phase 1** (Core Components)
5. **Monitor progress** using the checklist
6. **Adjust timeline** as needed based on actual progress

## Appendix A: Detailed File List

### Files Identified by extract-strings.js
(40 files with 240+ strings)

See `/tmp/strings-analysis.txt` for complete output with all identified strings.

### Key Files by Priority

**High Priority** (user-facing, frequently used):
1. Dashboard (home/index.tsx)
2. Current pack view (current-pack/[id].tsx)
3. Profile screens (name, username, notifications)
4. Error boundaries and states
5. Main navigation components

**Medium Priority** (important but less frequent):
1. Pack management screens
2. Item management screens
3. AI chat interface
4. Weather components
5. Trip management

**Low Priority** (admin/debug):
1. Demo screen
2. SQLite debug screen
3. Admin panels

## Appendix B: Translation Key Naming Convention

Follow this pattern for consistency:

```
<module>.<screen>.<element>.<variant>
```

Examples:
- `pack.detail.title` - Pack detail screen title
- `item.edit.save` - Item edit screen save button
- `error.network.message` - Network error message
- `search.placeholder.dashboard` - Dashboard search placeholder

## Contact & Support

For questions about this migration:
- See `lib/i18n/MIGRATION.md` for technical guidance
- See `lib/i18n/QUICKSTART.md` for quick reference
- See `lib/i18n/EXAMPLES.tsx` for code patterns
