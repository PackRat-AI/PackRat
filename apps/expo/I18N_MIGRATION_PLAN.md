# i18n Migration - Detailed Action Plan

## Complete File Inventory

Based on the analysis from `extract-strings.js`, here's the complete breakdown:

### Summary Statistics
- **Total files to migrate**: 40
- **Total strings identified**: 240+
- **Already migrated**: 7 files
- **Remaining files**: 33
- **Estimated total effort**: 28-37 hours

---

## File-by-File Breakdown

### PRIORITY 1: Core Components (5 files, ~20 strings, 2-3 hours)

| # | File | Strings | Complexity | Time Est. |
|---|------|---------|------------|-----------|
| 1 | `components/BackButton.tsx` | 1 | Low | 15 min |
| 2 | `components/CategoriesFilter.tsx` | 2 | Low | 20 min |
| 3 | `components/ai-chatHeader.tsx` | 2 | Low | 20 min |
| 4 | `components/initial/ErrorBoundary.tsx` | 3 | Medium | 30 min |
| 5 | `components/initial/ItemCard.tsx` | 3 | Medium | 30 min |

**Total Phase 1**: 1h 55min

---

### PRIORITY 2: Authentication Flow (8 files, ~60 strings, 4-5 hours)

| # | File | Strings | Complexity | Time Est. |
|---|------|---------|------------|-----------|
| 6 | `app/auth/index.tsx` | 9 | Medium | 45 min |
| 7 | `app/auth/(login)/index.tsx` | 4 | Low | 30 min |
| 8 | `app/auth/(login)/forgot-password.tsx` | 4 | Medium | 35 min |
| 9 | `app/auth/(login)/reset-password.tsx` | 11 | High | 60 min |
| 10 | `app/auth/(create-account)/index.tsx` | 3 | Low | 25 min |
| 11 | `app/auth/(create-account)/credentials.tsx` | 11 | High | 60 min |
| 12 | `app/auth/one-time-password.tsx` | 4 | Medium | 35 min |
| 13 | `app/auth/_layout.tsx` | 1 | Low | 15 min |

**Total Phase 2**: 4h 45min

---

### PRIORITY 3: Main App Screens (8 files, ~40 strings, 3-4 hours)

| # | File | Strings | Complexity | Time Est. |
|---|------|---------|------------|-----------|
| 14 | `app/(app)/(tabs)/(home)/index.tsx` | 4 | Medium | 30 min |
| 15 | `app/(app)/(tabs)/profile/name.tsx` | 1 | Low | 15 min |
| 16 | `app/(app)/(tabs)/profile/username.tsx` | 3 | Low | 20 min |
| 17 | `app/(app)/(tabs)/profile/notifications.tsx` | 3 | Low | 20 min |
| 18 | `app/(app)/(tabs)/sqlite-debug/index.tsx` | 14 | High | 75 min |
| 19 | `app/(app)/demo/index.tsx` | 20+ | High | 90 min |
| 20 | `screens/ErrorScreen.tsx` | 2 | Low | 15 min |

**Total Phase 3**: 4h 25min

---

### PRIORITY 4: Pack Management (8 files, ~60 strings, 5-6 hours)

| # | File | Strings | Complexity | Time Est. |
|---|------|---------|------------|-----------|
| 21 | `app/(app)/current-pack/[id].tsx` | 15 | High | 75 min |
| 22 | `app/(app)/pack/[id]/index.tsx` | ~12 | High | 60 min |
| 23 | `app/(app)/pack/[id]/edit.tsx` | ~10 | High | 60 min |
| 24 | `app/(app)/pack/[id]/feed.tsx` | ~8 | Medium | 45 min |
| 25 | `app/(app)/pack/new.tsx` | ~8 | Medium | 45 min |
| 26 | `app/(app)/weight-analysis/[id].tsx` | 9 | Medium | 50 min |

**Total Phase 4**: 5h 35min

---

### PRIORITY 5: Item Management (5 files, ~35 strings, 3-4 hours)

| # | File | Strings | Complexity | Time Est. |
|---|------|---------|------------|-----------|
| 27 | `app/(app)/item/[id]/index.tsx` | ~8 | Medium | 45 min |
| 28 | `app/(app)/item/[id]/edit.tsx` | ~8 | Medium | 45 min |
| 29 | `app/(app)/templateItem/[id]/index.tsx` | ~7 | Medium | 40 min |
| 30 | `app/(app)/templateItem/[id]/edit.tsx` | ~7 | Medium | 40 min |
| 31 | `app/(app)/templateItem/new.tsx` | ~5 | Medium | 35 min |

**Total Phase 5**: 3h 25min

---

### PRIORITY 6: Additional Features (6 files, ~25 strings, 2-3 hours)

| # | File | Strings | Complexity | Time Est. |
|---|------|---------|------------|-----------|
| 32 | `app/(app)/ai-chat.tsx` | ~5 | Medium | 30 min |
| 33 | `app/(app)/gear-inventory.tsx` | ~5 | Medium | 30 min |
| 34 | `app/(app)/season-suggestions.tsx` | ~4 | Medium | 25 min |
| 35 | `app/(app)/shopping-list.tsx` | ~4 | Medium | 25 min |
| 36 | `app/(app)/trip/[id]/index.tsx` | ~4 | Medium | 25 min |
| 37 | `app/(app)/trip/[id]/edit.tsx` | ~3 | Medium | 20 min |

**Total Phase 6**: 2h 35min

---

### PRIORITY 7: Weather Feature (3 files, ~15 strings, 1-2 hours)

| # | File | Strings | Complexity | Time Est. |
|---|------|---------|------------|-----------|
| 38 | `app/(app)/weather/index.tsx` | ~6 | Medium | 35 min |
| 39 | `app/(app)/weather-forecast.tsx` | ~5 | Medium | 30 min |
| 40 | `features/weather/*` | ~4 | Medium | 30 min |

**Total Phase 7**: 1h 35min

---

## Translation Keys to Add

### New Categories Needed in en.json

```json
{
  "backButton": {
    "label": "Back"
  },
  
  "categories": {
    "failedToLoad": "Failed to load categories",
    "retry": "Retry"
  },
  
  "aiChat": {
    "header": "PackRat AI",
    "subtitle": "Your Hiking Assistant"
  },
  
  "errorBoundary": {
    "title": "Something went wrong",
    "message": "The application encountered an unexpected error. You can try again or go back to the home screen.",
    "goHome": "Go Home"
  },
  
  "itemCard": {
    "consumable": "Consumable",
    "worn": "Worn",
    "quantity": "Qty: {{quantity}}"
  },
  
  "errorScreen": {
    "tryAgain": "Try Again",
    "goHome": "Go Home"
  },
  
  "dashboard": {
    "title": "Dashboard",
    "noResults": "No matching tiles found",
    "tryDifferent": "Try different keywords or clear your search",
    "searchPlaceholder": "Search dashboard"
  },
  
  "profileSettings": {
    "name": {
      "save": "Save"
    },
    "username": {
      "save": "Save",
      "label": "Username",
      "prefix": "@"
    },
    "notifications": {
      "save": "Save",
      "push": "Push Notifications",
      "email": "Email Notifications"
    }
  },
  
  "sqliteDebug": {
    "title": "SQLite KV-Store Debug",
    "addNew": "Add New Entry",
    "editEntry": "Edit Entry: {{key}}",
    "storedEntries": "Stored Entries",
    "noEntries": "No entries found",
    "addEntry": "Add Entry",
    "cancel": "Cancel",
    "save": "Save",
    "refresh": "Refresh",
    "edit": "Edit",
    "delete": "Delete",
    "clearAll": "Clear All Data",
    "key": "Key",
    "valuePlaceholder": "Value (string or JSON)"
  },
  
  "currentPack": {
    "title": "Current Pack",
    "totalWeight": "Total Weight",
    "baseWeight": "Base Weight",
    "categories": "Categories",
    "items": "Items",
    "lastUpdated": "Last updated: {{time}}",
    "weightWithUnit": "{{weight}} g",
    "categoryWeight": "{{weight}} {{unit}} • {{count}} {{label}}"
  },
  
  "demo": {
    "title": "Demo",
    "noComponents": "No Components Installed",
    "mainScreens": "Main Screens",
    "modals": "Modals",
    "additionalScreens": "Additional Screens",
    "dashboard": "Dashboard",
    "packs": "Packs",
    "items": "Items",
    "catalog": "Catalog",
    "newPack": "New Pack",
    "newItem": "New Item",
    "settings": "Settings",
    "login": "Login",
    "messages": "Messages (Conversations)",
    "chat": "Messages (Chat)",
    "aiChat": "AI Chat",
    "aiChatBetter": "AI Chat (Better UI)"
  },
  
  "pack": {
    "weightAnalysis": {
      "title": "Weight Analysis",
      "subtitle": "Detailed analysis of your pack weight by category",
      "breakdown": "Weight Breakdown",
      "baseWeight": "Base Weight",
      "consumablesWeight": "Consumables Weight",
      "wornWeight": "Worn Weight",
      "totalWeight": "Total Weight",
      "percentageOfTotal": "{{percentage}}% of total",
      "emptyMessage": "Add items and categorize them for weight breakdown."
    },
    "new": {
      "title": "New Pack"
    },
    "edit": {
      "title": "Edit Pack"
    },
    "detail": {
      "title": "Pack Details"
    },
    "feed": {
      "title": "Pack Feed"
    }
  },
  
  "auth": {
    "index": {
      "loginRequired": "Login Required",
      "braceYourself": "Brace Yourself",
      "forWhatsNext": "for What's Next",
      "signInMessage": "Sign in to unlock cloud sync and access all features",
      "signUpFree": "Sign up free",
      "continueWithGoogle": "Continue with Google",
      "continueWithApple": "Continue with Apple",
      "logIn": "Log in",
      "continueWithout": "Continue without logging in"
    },
    "login": {
      "welcomeBack": "Welcome back!",
      "forgotPassword": "Forgot password?",
      "createAccount": "Create Account",
      "cancel": "Cancel"
    },
    "forgotPassword": {
      "title": "Forgot password",
      "titleIos": "What's your email?",
      "message": "Enter your email address and we'll send you a verification code to reset your password.",
      "createAccount": "Create Account"
    },
    "resetPassword": {
      "title": "Create New Password",
      "message": "Your new password must be different from previously used passwords.",
      "passwordStrength": "Password strength:",
      "minLength": "At least 8 characters",
      "uppercase": "At least 1 uppercase letter",
      "lowercase": "At least 1 lowercase letter",
      "number": "At least 1 number",
      "special": "At least 1 special character",
      "showPassword": "Show password",
      "next": "Next",
      "submit": "Reset Password",
      "resetting": "Resetting..."
    },
    "createAccount": {
      "title": "Create your account",
      "titleIos": "What's your name?",
      "welcomeBack": "Welcome back!",
      "alreadyHaveAccount": "Already have an account?"
    },
    "credentials": {
      "title": "Create Account",
      "titleIos": "Set up your credentials",
      "passwordStrength": "Password strength:",
      "minLength": "At least 8 characters",
      "uppercase": "At least 1 uppercase letter",
      "lowercase": "At least 1 lowercase letter",
      "number": "At least 1 number",
      "special": "At least 1 special character",
      "showPassword": "Show password",
      "next": "Next",
      "submit": "Submit",
      "loading": "Loading..."
    },
    "otp": {
      "didntReceive": "Didn't receive the code?",
      "resendIn": "Resend in {{countdown}} second{{plural}}",
      "resend": "Resend",
      "continue": "Continue"
    }
  },
  
  "weatherForecast": {
    "title": "Weather Forecast",
    "lastUpdated": "Weather data last updated: {{date}}",
    "alerts": "Weather Alerts"
  }
}
```

---

## Execution Plan

### Week 1: Foundation & Authentication
- **Day 1**: Phase 1 - Core Components (2-3 hours)
- **Day 2**: Phase 2 Part 1 - Auth screens 1-4 (2-3 hours)
- **Day 3**: Phase 2 Part 2 - Auth screens 5-8 (2-3 hours)
- **Day 4**: Phase 3 Part 1 - Main screens (2-3 hours)
- **Day 5**: Testing & validation of Week 1 (2-3 hours)

### Week 2: Pack & Item Management
- **Day 1**: Phase 4 Part 1 - Pack screens 1-3 (3 hours)
- **Day 2**: Phase 4 Part 2 - Pack screens 4-6 (3 hours)
- **Day 3**: Phase 5 - Item management (3-4 hours)
- **Day 4**: Phase 6 - Additional features (2-3 hours)
- **Day 5**: Phase 7 - Weather + Final testing (3-4 hours)

### Total Time: ~30 hours over 2 weeks

---

## Quality Checklist

For each file:
- [ ] Run `node lib/i18n/extract-strings.js` before starting
- [ ] Add new keys to `en.json` in appropriate section
- [ ] Import `useTranslation` hook
- [ ] Replace all hardcoded strings with `t()` calls
- [ ] Handle variable interpolation (e.g., `{{name}}`)
- [ ] Update `types.ts` with new translation keys
- [ ] Test the screen/component manually
- [ ] Run `node lib/i18n/extract-strings.js` again to verify
- [ ] Code review
- [ ] Commit with descriptive message

---

## Validation Steps

After completing migration:

1. **Automated Check**:
   ```bash
   node apps/expo/lib/i18n/extract-strings.js
   ```
   Should show 0 files with hardcoded strings

2. **Manual Testing**:
   - Navigate to every screen
   - Verify all text displays correctly
   - Test error states
   - Test with long strings
   - Test variable interpolation

3. **Type Safety**:
   - Run TypeScript compiler
   - Verify no type errors
   - Check autocomplete works for translation keys

4. **Documentation**:
   - Update `en.json` with all new keys
   - Update `types.ts` with new key types
   - Update migration docs if needed

---

## Risk Mitigation

### Risks Identified
1. **Missing edge cases** - Some dynamic strings might be missed
2. **Breaking changes** - Incorrect migration could break functionality
3. **Performance** - Too many re-renders with useTranslation

### Mitigation
1. Use extract-strings.js before and after each file
2. Test thoroughly before committing
3. Keep useTranslation at component level, not in loops

---

## Success Metrics

- ✅ 40/40 files migrated
- ✅ 0 hardcoded strings remaining
- ✅ 240+ translation keys in en.json
- ✅ All screens tested and functional
- ✅ Types updated and no TypeScript errors
- ✅ Documentation complete
- ✅ Code review approved

---

## Next Actions

1. **Review this plan** with team
2. **Assign developer(s)** for execution
3. **Set timeline** based on availability
4. **Start with Phase 1** (low-hanging fruit)
5. **Monitor progress** using checklist
6. **Adjust** as needed

---

## Support Resources

- 📚 Migration guide: `lib/i18n/MIGRATION.md`
- 📚 Quick reference: `lib/i18n/QUICKSTART.md`
- 📚 Code examples: `lib/i18n/EXAMPLES.tsx`
- 🔧 String detector: `lib/i18n/extract-strings.js`
- 📝 Type definitions: `lib/i18n/types.ts`
