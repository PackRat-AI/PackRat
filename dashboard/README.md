# Agent Dashboard Tests

This directory contains simple tests for the agent dashboard core functionality.

## Running Tests

Open `tests.html` in a browser, or run with Node.js:

```bash
node tests.js
```

## Test Coverage

### Data Functions
- `testGenerateStoryId()` - Tests story ID generation
- `testCapitalize()` - Tests string capitalization
- `testEscapeHtml()` - Tests HTML escaping
- `testGetInitials()` - Tests initials generation

### Filtering
- `testApplyFilters()` - Tests story filtering by assignee, priority, status
- `testClearFilters()` - Tests filter clearing

### UI Functions
- `testModalOpenClose()` - Tests modal open/close
- `testToastNotification()` - Tests toast notifications

### Mock Data
- `testMockDataIntegrity()` - Ensures mock data has required fields
- `testMockAgentsHaveUniqueNames()` - Ensures agent names are unique
- `testMockStoriesHaveValidStatuses()` - Ensures story statuses are valid
