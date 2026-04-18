/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0 web flows.
 *
 * Uses the Web Crypto API which is available in Cloudflare Workers, modern
 * browsers, and Node.js 20+.
 */

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generate a cryptographically random PKCE code verifier.
 * Produces a 43-character base64url string from 32 random bytes.
 */
export function generateCodeVerifier(): string {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return base64urlEncode(buffer.buffer);
}

/**
 * Derive the PKCE code challenge from a code verifier using SHA-256.
 * code_challenge = BASE64URL(SHA256(ASCII(code_verifier)))
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(codeVerifier);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return base64urlEncode(hash);
}

/**
 * Generate a random state token for CSRF protection.
 * Produces a 22-character base64url string from 16 random bytes.
 */
export function generateOAuthState(): string {
  const buffer = new Uint8Array(16);
  crypto.getRandomValues(buffer);
  return base64urlEncode(buffer.buffer);
}
