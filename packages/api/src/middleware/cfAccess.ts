import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';

const CFAccessPayloadSchema = z.object({ email: z.string().min(1) });

export type CFAccessIdentity = z.infer<typeof CFAccessPayloadSchema>;

// Module-level singleton — survives across requests on warm isolates.
// jose caches keys internally by kid; re-fetches only on unknown key rotation.
let moduleJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let moduleTeamDomain: string | null = null;

function getJwks(teamDomain: string): ReturnType<typeof createRemoteJWKSet> {
  if (!moduleJwks || moduleTeamDomain !== teamDomain) {
    // teamDomain is the full URL: "https://<team>.cloudflareaccess.com"
    moduleJwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    moduleTeamDomain = teamDomain;
  }
  return moduleJwks;
}

type CFAccessVerifyOptions = { teamDomain: string; aud: string };

/**
 * Extracts and verifies the CF-Access-JWT-Assertion header from the request
 * against the team's public JWKS. Validates both issuer and audience.
 *
 * Only call when both teamDomain and aud are configured.
 * Returns null when the header is absent or the token fails verification.
 *
 * teamDomain must be the full URL: "https://<team>.cloudflareaccess.com"
 * aud is the CF Access Application Audience tag.
 */
// biome-ignore lint/complexity/useMaxParams: three semantically distinct required params
export async function verifyCFAccessRequest(
  request: Request,
  { teamDomain, aud }: CFAccessVerifyOptions,
): Promise<CFAccessIdentity | null> {
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwks(teamDomain), {
      audience: aud,
      issuer: teamDomain, // CF Access JWT iss == team domain URL
    });
    const result = CFAccessPayloadSchema.safeParse(payload);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
