# Authentication System

This directory contains the authentication system for the PackRat mobile application.

## Re-authentication Flow

When a user's session expires (access token and refresh token both expire), the app automatically triggers a re-authentication flow with a non-blocking "Sync Paused" banner. This fits the local-first model where users can continue working offline while being notified they need to re-authenticate to sync changes.

### How It Works

1. **Token Expiration Detection**
   - The axios interceptor in `lib/api/client.ts` intercepts all API requests
   - When a 401 Unauthorized error occurs, it attempts to refresh the access token
   - If refresh fails, it triggers re-authentication

2. **Re-authentication State**
   - `needsReauthAtom`: Boolean flag indicating re-authentication is required

3. **User Experience**
   - A non-blocking banner (`SyncBanner`) appears at the top of the screen
   - Banner displays a message prompting user to sign in again
   - User can continue working with local data while offline
   - User can tap the banner to navigate to the auth screen
   - After successful sign-in, user is redirected back to their previous location

4. **State Management**
   - Current path is automatically passed for post-authentication redirect
   - After successful sign-in / logout, all re-auth state is cleared

### Files

- `components/SyncBanner.tsx`: Banner component displayed when session expires
- `atoms/authAtoms.ts`: Jotai atoms for authentication state including re-auth flags
- `hooks/useAuthActions.ts`: Actions for sign-in, sign-out, and state management
- `lib/api/client.ts`: Axios interceptor handling token refresh and re-auth triggering

### Example Flow

```typescript
// 1. User makes API request with expired token
await axiosInstance.get('/api/user/profile');

// 2. Server returns 401, interceptor tries to refresh
// 3. Refresh token is also expired - 401
// 4. Interceptor sets re-auth state
await store.set(needsReauthAtom, true);

// 5. SyncBanner appears at top of screen
// 6. User can continue working offline OR tap banner to sign in
// 7. User taps banner and completes sign-in
await signIn(email, password);

// 8. Re-auth state is cleared
await setNeedsReauth(false);

// 9. User is redirected to saved path
redirect(redirectTo);
```

## Token Lifecycle

- **Access Token**: Valid for 7 days, stored in `access_token` key
- **Refresh Token**: Valid for 30 days, stored in `refresh_token` key
- Both tokens are stored using `expo-sqlite/kv-store` for persistence
- Tokens are automatically attached to requests via axios interceptor

## Sign-In Methods

The app supports multiple authentication methods:
- Email/Password (`signIn`)
- Google Sign-In (`signInWithGoogle`)
- Apple Sign-In (`signInWithApple`)

All methods reset re-authentication state upon successful authentication.
