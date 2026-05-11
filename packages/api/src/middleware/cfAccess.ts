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

interface CFAccessOptions {
  teamDomain: string;
  aud: string;
}

export async function verifyCFAccessRequest(
  request: Request,
  opts: CFAccessOptions,
): Promise<CFAccessIdentity | null> {
  const { teamDomain, aud } = opts;
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
