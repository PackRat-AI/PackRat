/**
 * Favicon for the MCP OAuth host (`mcp.packratai.com/favicon.ico`).
 *
 * Anthropic's domain-ownership verification probe hits the OAuth domain's
 * `/favicon.ico` — not the landing site at `packratai.com`. The two
 * domains are distinct from Cloudflare's perspective, so we can't rely on
 * the landing site's favicon being served at the worker's host.
 *
 * Chosen approach: embed the PackRat .ico as a base64 string at build
 * time so the worker is self-contained (no runtime fetch to the landing
 * site, no extra Cloudflare binding, no race on cold-start). The icon
 * is small (~4.2 KiB binary, ~5.7 KiB base64) so the bundle overhead is
 * negligible.
 *
 * To refresh: copy a new icon to `apps/landing/public/favicon.ico` and
 * re-run `base64 -w 0 < that.ico` to produce a new value for
 * `FAVICON_ICO_BASE64`. The source-of-truth file is the landing site's
 * `public/favicon.ico` (also used by Next.js for the brand domain
 * favicon, which keeps the two surfaces visually consistent).
 *
 * Operator runbook entry: `docs/mcp/runbook.md` § "U13 listing artifacts".
 */

// Base64-encoded copy of `apps/landing/public/favicon.ico` as of U13.
// 32x32 32-bpp .ico, ~4.2 KiB binary.
const FAVICON_ICO_BASE64 =
  'AAABAAEAICAAAAEAIACoEAAAFgAAACgAAAAgAAAAQAAAAAEAIAAAAAAAABAAAMMOAADDDgAAAAAAAAAAAACtYAr/rF4K/6tdCv+pWwv/qFoL/6dYC/+lVwv/pFUL/6JUC/+hUgz/oFEM/55PDP+dTgz/nEwM/5pLDf+ZSQ3/mEgN/5ZGDf+VRQ3/k0MO/5JCDv+RQA7/jz8O/449Dv+NPA7/izoP/4o5D/+INw//hzYP/4Y0D/+EMxD/gzEQ/65hCv+tYAr/rF4K/6tdCv+pWwv/qFoL/6ZYC/+lVwv/pFUL/6JUC/+hUgz/oFEM/55PDP+dTgz/m0wM/5pLDf+ZSQ3/l0gN/5ZGDf+VRQ3/k0MO/5JCDv+RQA7/jz8O/449Dv+MPA7/izoP/4o5D/+INw//hzYP/4Y0D/+EMxD/sGMK/69hCv+tYAr/rF4K/6tdCv+pWwv/qFoL/6ZYC/+lVwv/o1UK/6JSCf+hUw3/oFEM/55PDP+dTgz/m0wM/5pLDf+ZSQ3/l0gN/5ZGDf+VRQ3/k0MN/5JCDv+RQA7/jz8O/449Dv+MPA7/izoP/4o5D/+INw//hzYP/4Y0D/+xZAn/sGMK/69hCv+tYAr/rF4K/6tdCv+pWwv/qFoL/6ZXCf+oXBP/xpVm/7uCTv+gUAn/oFEM/55PDP+dTgz/nEwM/5pLDf+ZSQ3/l0gN/5ZGDf+VRQ3/k0MO/5JCDv+RQA7/jz8O/449Dv+MPA7/izoP/4o5D/+INw//hzYP/7NmCf+xZAn/sGMK/69hCv+tYAr/rF4K/6pdCv+pWgn/tXIv/+DFqv/r2cf/tnc7/6FSCf+hUgz/oFEM/55PDP+dTgz/m0wM/5pLDf+YSAz/mEkO/5ZFDP+VRQ3/k0MO/5JCDv+RQA7/jz8O/449Dv+MPA7/izoP/4o5D/+INw//tGcJ/7NmCf+xZAn/sGMK/69hCv+tYAr/rF4K/6lbB//Ci1H/7dzL/7d4Ov+mWA7/o1MJ/6JSCf+gUQn/n1AL/55PDP+dTgz/mkoJ/6ZgKf/TsZj/sndM/5VECv+VRA3/k0MO/5JCDv+RQA7/jz8O/449Dv+MPA7/izoP/4o5D/+1aQn/tGcJ/7NmCf+xZAn/sGMK/65gB/+tXwn/rF4J/65kFf/gw6b/7NzL/+HIrv+9g0v/rmko/69rLf+oXx7/n1AL/51NCf+sajL/2r2m/97Er//s3tP/uIFZ/5ZHDv+VRQ3/k0MN/5FADP+QQA7/jz8O/449Dv+MPA7/izoP/7dqCf+2aQn/tGcJ/7NmCf+zaA//v4E6/7JnFP+tXwn/q1wG/8mXYf/+/fv///////nz7f/06uH/9e3m/+7f0v/UsJD/06+P//Dj2P/dwav/nlAR/7+MZP/MpYb/nFAY/5ZGDP+XSRP/oVor/5NDEP+RQA7/jz8O/449Dv+NPA7/uGwI/7dqCf+1aQn/tGcJ/7RoDP/JlFX/0aRx/7JnE/+tXwj/smkb/+rWwf///////////////////////////////////////////8qfe/+bSwj/m0sK/5pLDv+ZSQ3/lkUK/7V8U//EmHr/lEQO/5JCDv+RQA7/jz8O/449Dv+5bQj/uGwI/7dqCf+1aQn/tGcJ/7JkBv/Nml//xItK/65fBv+uYg3/5Muw///////////////////////////////////////x5dr/r2wy/51OCv+dTgz/m0wM/5pKDP+dUBf/wZFt/6RfLv+URAz/k0MO/5JCDv+QQA7/jz8O/7tvCP+6bQj/uGwI/7dqCf+1aQn/s2YH/79+MP/Ro23/rmAF/7NqGP/v4dD//////////////////////////////////////9Swj/+gUQr/oFEM/55PDP+dTgz/m0sK/7Z9UP+ydkj/lkUK/5ZGDf+VRQ3/k0MN/5JCDv+RQA7/vHAI/7tvCP+6bQj/uGwI/7dqCf+1aQn/t2wR/9Oncv/MmV7/xo5N//Tp3f//////////////////////////////////////3sOp/6NVDf+hUgz/oFEM/51OCv+oYSf/wZBo/51PE/+ZSQ3/l0gN/5ZGDf+VRQ3/k0MO/5JCDv++cgj/vHAI/7tvCP+6bQj/uGwI/7dqCf+1aAj/uG4V/8WLRP/Ll1r/8+fZ///////////////////////////////////////n0r7/ploS/6JTC/+hUgv/olUS/8GOY/+raDD/m0sK/5pLDf+ZSQ3/l0gN/5ZGDf+VRQ3/k0MO/79zCP++cgj/vHAI/7tvCP+6bQj/uGwI/7dqCf+1aAj/s2UF/7RoDf/p07n//////////////////////////////////////+nXxP+oXRT/olIH/6NVDP/LoHn/yZx2/55PC/+dTgz/m0wM/5pLDf+ZSQ3/l0gN/5ZGDf+VRQ3/wHUH/79zCP++cgj/vHAI/7tvCP+6bQj/uGwI/7ZpBv+2awz/tmsP/+HCnf//////////////////////////////////////7NvJ/65mH/+3eTz/zKF5//Pp4P/Ai1z/nk4I/55PDP+dTgz/m0wM/5pLDf+ZSQ3/l0gN/5ZGDf/Cdgf/wHUH/79zCP++cgj/vHAI/7tvCP+7cA3/0qNk/+jQsv/lyqn/5s2u//r17//////////////////////////////////58+7/5c63//nz7v//////4cev/6ddGP+hUgv/oFEM/55PDP+dTgz/nEwM/5pLDf+ZSQ3/mEgN/8N4B//Cdgf/wHUH/79zCP++cgj/u24E/86YTv/79/L////////////ly6r/6dG1/////////////////////////////////////////////////+zby/+xbCr/o1QJ/6JUC/+hUgz/oFEM/55PDP+dTgz/m0wM/5pLDf+ZSQ3/xHkH/8N4B//Cdgf/wHUH/79zB/+/dg//4L2M//////////////////z49P/jxqH/+PHn///////////////////////////////////////+/fv/x5Rh/6VVBv+lVwv/pFUL/6JUC/+hUgz/oFEM/55PDP+dTgz/m0wM/5pLDf/Gewf/xXkH/8N4B//Cdgf/v3MD/9enYv/27N7/+/fx//////////////////Xr3v/lyqn//fr3//////////////////////////////////r28v+7fT7/p1gI/6ZYC/+lVwv/pFUL/6JUC/+hUgz/oFEM/55PDP+dTgz/nEwM/8d8Bv/Gewf/xXkH/8N4B//BdQT/0ZlH//nx5//37eD//vz5/////////////////+vXvf/nza3///79/////////////////////////////v79/86gcf+oWAb/plcH/6ZYCv+lVwv/pFUL/6JUC/+hUgz/oFEM/55PDP+dTgz/yH4G/8d8Bv/Gewf/xHkH/8N4B//Cdwj/4LqC//v28P/48OT////+/////////////fv4/+rTtv/27eH///7+////////////////////////////9ezi/9eyjP/Ah0z/q18S/6ZXCf+lVwv/pFUL/6JUC/+hUgz/oFEM/55PDP/Kfwb/yX4G/8d8Bv/Gewf/xXkH/8N3Bv/Gfxf/37mB/9uxdf/16df/////////////////7dnA/8uTTP/u3cf///////////////////////////////////////v49P/ewKL/sGkh/6ZXCf+lVwv/pFUL/6JUC/+hUgz/oFEM/8uBBv/Kfwb/yX4G/8d8Bv/Gewf/xXkH/8N3Bv/BdQX/v3ME/9alX//8+PP//////////v/asXv/u3IS/9qzgf///v7////////////////////////////////////////////dvp7/ql4R/6ZYCv+lVwv/pFUL/6JUC/+hUgz/zYIG/8uBBv/Kfwb/yX4G/8d8Bv/Gewf/xXkH/8N4B//Cdgb/wXcL/9amYP/myqH/4LyK/9iscv/u28L//Pjz//////////////////////////////////////////////////r18P/CilH/qFkK/6ZYC/+lVwv/pFUL/6JUC//OhAX/zYIG/8uBBv/Kfwb/yX4G/8d8Bv/Gewf/xHkH/8N4B//Cdgf/wHMF/79zB/+/dQ7/6tKx///////////////////////////////////////z59n/8ubX/+XMr//TqXr/yphi/8eUXv+sYRP/qFkL/6ZYC/+lVwv/pFUL/8+FBf/OhAX/zYIG/8uBBv/Kfwb/yX4G/8d8Bv/Gewf/xXkH/8N4B//Cdgf/wHQG/8J7FP/x4Mn//////////////////v38//369///////+vXv/8mUU/+4ch//smYP/61fBv+sXQb/rF4K/6tdCv+pWwv/qFoL/6ZYC/+lVwv/0YcF/8+GBf/OhAX/zYIG/8uBBv/Kfwb/yX4G/8d8Bv/Gewf/xXkH/8N4B//Cdgf/wXUI/+G9if////7////////////nzKn/y5NK/9KiZP/Ij0f/tmwQ/7JkB/+xZAn/sGMK/69hCv+tYAr/rF4K/6tdCv+pWwv/qFoL/6dYC//SiAX/0YcF/8+FBf/OhAb/zYIG/8uBBv/Kfwb/yX4G/8d8Bv/Gewf/xXkH/8N4B//Bdgb/xX8Z/963fv/r1LT/37uK/8J9If+4agP/t2kE/7ZoBf+1aQj/tGcJ/7NmCf+xZAn/sGMK/69hCv+tYAr/rF4K/6tdCv+pWwv/qFoL/9OKBf/SiAX/0YcF/8+FBf/OhAX/zYIG/8uBBv/Kfwb/yX4G/8d8Bv/Gewf/xHkH/8N4B//Bdgb/wHQG/8B1C/+9cQf/vG8G/7tvCP+6bQj/uGwI/7dqCf+1aQn/tGcJ/7NmCf+xZAn/sGMK/69hCv+tYAr/rF4K/6pdCv+pWwv/1YsF/9SKBf/SiAX/0YcF/8+FBf/OhAX/zYIG/8uBBv/Kfwb/yX4G/8d8Bv/Gewf/xXkH/8N4B//Cdgf/wHUH/79zB/++cgj/vHAI/7tvCP+6bQj/uGwI/7dqCf+1aQn/tGcJ/7NmCf+xZAn/sGMK/69hCv+tYAr/rF4K/6tdCv/WjQT/1YwF/9SKBf/SiAX/0YcF/8+GBf/OhAX/zYIG/8uBBv/Kfwb/yX4G/8d8Bv/Gewf/xXkH/8N4B//Cdgf/wHUH/79zCP++cgj/vHAI/7tvCP+6bQj/uGwI/7dqCf+2aQn/tGcJ/7NmCf+xZAn/sGMK/69hCv+tYAr/rF4K/9eOBP/WjQT/1YsF/9OKBf/SiAX/0YcF/8+FBf/OhAb/zYIG/8uBBv/Kfwb/yH4G/8d8Bv/Gewf/xHkH/8N4B//Cdgf/wHUH/79zCP++cgj/vHAI/7tvCP+5bQj/uGwJ/7dqCf+1aQn/tGcJ/7NmCf+xZAn/sGMK/65hCv+tYAr/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

function decodeBase64(b64: string): Uint8Array {
  // `atob` is available in Workers per the Web platform globals.
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Pre-decode once at module load — Workers run the module init exactly
// once per isolate, so the binary buffer is allocated up front and every
// /favicon.ico hit just re-wraps it in a Response.
const FAVICON_BYTES: Uint8Array = decodeBase64(FAVICON_ICO_BASE64);

/**
 * Serve the favicon as a 200 with the correct content type + a long
 * `Cache-Control` so Anthropic's probe (and downstream clients) don't
 * re-fetch it on every request.
 *
 * The MIME type `image/x-icon` is the legacy registered value; modern
 * browsers also accept `image/vnd.microsoft.icon`. We stick with the
 * legacy value because that is exactly what Anthropic's domain probe
 * grep tools look for when verifying domain ownership.
 */
export function faviconResponse(): Response {
  // Slice into a fresh Uint8Array view so the Response body's stream is
  // a fresh buffer per request — avoids any Workers-side concern about
  // re-using a typed-array backing store across concurrent requests.
  const body = FAVICON_BYTES.slice();
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'image/x-icon',
      'Content-Length': String(body.byteLength),
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}

/** Exposed for the test suite: assert the embedded payload decodes cleanly. */
export const FAVICON_BYTE_LENGTH = FAVICON_BYTES.byteLength;
