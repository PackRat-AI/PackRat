# PackRat Maestro E2E Tests

This directory contains end-to-end tests for the PackRat mobile app using [Maestro](https://maestro.mobile.dev).

## Structure

```text
.maestro/
├── config.yaml                    # Maestro suite configuration & flow order
└── flows/
    ├── setup/
    │   └── clear-state.yaml       # Clears app state before test suite
    ├── auth/
    │   ├── login-flow.yaml        # Sign in with email and password
    │   └── logout-flow.yaml       # Sign out from the app
    ├── trips/
    │   └── create-trip-flow.yaml  # Create a new trip
    └── packs/
        └── create-pack-flow.yaml  # Create a new pack
```

## Prerequisites

1. **Install Maestro CLI**:
   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   ```

2. **Set up environment variables** for test credentials:
   ```bash
   export TEST_EMAIL="your-test-account@example.com"
   export TEST_PASSWORD="your-test-password"
   ```

3. **Build and install the app** on a simulator/device (run from `apps/expo/`):
   ```bash
   eas build --platform ios --profile e2e --local --output ./build/PackRat-sim.tar.gz
   mkdir -p ./build/extracted
   tar -xzf ./build/PackRat-sim.tar.gz -C ./build/extracted
   xcrun simctl install booted ./build/extracted/*.app
   ```

## Running Tests

### Run all flows
```bash
maestro test .maestro/config.yaml
```

### Run a single flow
```bash
maestro test .maestro/flows/auth/login-flow.yaml
```

### Run with JUnit output (for CI)
```bash
maestro test --format junit --output test-results.xml .maestro/config.yaml
```

### Run on a specific simulator
```bash
maestro --device <UDID> test .maestro/config.yaml
```

## CI/CD

Tests run automatically via GitHub Actions (`.github/workflows/e2e-tests.yml`) on:
- Every push to `main` or `development` that touches `apps/expo/**`, `.maestro/**`, or `.github/workflows/e2e-tests.yml`
- Every pull request targeting `main` or `development` that touches the same paths

> **Note:** Forked pull requests are skipped because repository secrets are not available.

### Required Secrets

Configure these GitHub repository secrets for CI:

| Secret | Description |
|--------|-------------|
| `EXPO_TOKEN` | Expo access token for EAS builds |
| `E2E_TEST_EMAIL` | Email address of the E2E test account |
| `E2E_TEST_PASSWORD` | Password of the E2E test account |
| `PACKRAT_NATIVEWIND_UI_GITHUB_TOKEN` | GitHub token for private package access |

## Writing New Tests

Flows are standard YAML files following the [Maestro flow syntax](https://maestro.mobile.dev/api-reference/commands).

Key conventions:
- All flows start with `appId: com.andrewbierman.packrat`
- Prefer `testID` selectors first (e.g., `tapOn: { id: "submitButton" }`), then `accessibilityLabel` (e.g., `tapOn: { accessibilityLabel: "Submit" }`); use `text` only as a last resort when no stable `testID` or accessibility selector exists
- Use `waitForAnimationToEnd` after navigation actions
- Use `runFlow: { when: { visible: ... } }` for conditional steps
- Use environment variables (e.g., `${TRIP_NAME}`) for entity names to keep each test run unique

## Troubleshooting

- **Element not found**: Run `maestro studio` for interactive element inspection
- **Flaky tests**: Add `waitForAnimationToEnd` before assertions
- **Simulator issues**: Ensure the simulator is booted before running tests
