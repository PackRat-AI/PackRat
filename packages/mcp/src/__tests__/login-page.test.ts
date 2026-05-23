import { describe, expect, it } from 'vitest';
import { renderLoginPage } from '../login-page';

describe('renderLoginPage', () => {
  const baseOpts = { state: 'state-abc', csrf: 'csrf-xyz' };

  describe('document shape', () => {
    it('returns a complete HTML document', () => {
      const html = renderLoginPage(baseOpts);
      expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
      expect(html.includes('<html lang="en">')).toBe(true);
      expect(html.includes('</html>')).toBe(true);
    });

    it('sets the page title and noindex meta', () => {
      const html = renderLoginPage(baseOpts);
      expect(html).toContain('<title>Sign in · PackRat</title>');
      expect(html).toContain('name="robots" content="noindex,nofollow"');
    });

    it('includes the responsive viewport meta', () => {
      expect(renderLoginPage(baseOpts)).toContain(
        '<meta name="viewport" content="width=device-width, initial-scale=1"',
      );
    });
  });

  describe('branding', () => {
    it('renders the PackRat brand mark and name', () => {
      const html = renderLoginPage(baseOpts);
      // SVG logo + accessible title for screen readers
      expect(html).toContain('<svg');
      expect(html).toContain('<title>PackRat</title>');
      expect(html).toContain('class="brand-name">PackRat<');
    });

    it('uses the product-blue accent color', () => {
      expect(renderLoginPage(baseOpts)).toContain('--brand: #2563eb');
    });

    it('declares a dark-mode color scheme', () => {
      expect(renderLoginPage(baseOpts)).toContain('@media (prefers-color-scheme: dark)');
    });
  });

  describe('OAuth client name disclosure', () => {
    it('uses the generic copy when no clientName is provided', () => {
      const html = renderLoginPage(baseOpts);
      expect(html).toContain('An MCP client is requesting access to your PackRat account.');
    });

    it('renders the client name when provided', () => {
      const html = renderLoginPage({ ...baseOpts, clientName: 'Claude' });
      expect(html).toContain('Claude is requesting access to your PackRat account.');
    });

    it('HTML-escapes a malicious clientName', () => {
      // Client name originates in attacker-controllable DCR metadata when a
      // client registers without going through the operator pre-registration
      // script. The escape is load-bearing.
      const html = renderLoginPage({
        ...baseOpts,
        clientName: '<script>alert(1)</script>',
      });
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('hidden form fields', () => {
    it('echoes the state into a hidden input', () => {
      expect(renderLoginPage(baseOpts)).toContain(
        '<input type="hidden" name="state" value="state-abc"',
      );
    });

    it('echoes the CSRF nonce into a hidden input', () => {
      expect(renderLoginPage(baseOpts)).toContain(
        '<input type="hidden" name="csrf" value="csrf-xyz"',
      );
    });

    it('HTML-escapes state and csrf values', () => {
      const html = renderLoginPage({
        state: '">payload<',
        csrf: '">other<',
      });
      expect(html).not.toContain('value="">payload<');
      expect(html).toContain('&quot;&gt;payload&lt;');
      expect(html).toContain('&quot;&gt;other&lt;');
    });
  });

  describe('helper + legal footer', () => {
    it('links the password-reset path (mailto for v1)', () => {
      const html = renderLoginPage(baseOpts);
      expect(html).toContain('PackRat%20password%20reset');
      expect(html).toContain('Forgot your password?');
    });

    it('links the canonical Terms, Privacy, and Support targets', () => {
      const html = renderLoginPage(baseOpts);
      expect(html).toContain('href="https://packratai.com/terms-of-service"');
      expect(html).toContain('href="https://packratai.com/privacy-policy"');
      expect(html).toContain('href="mailto:hello@packratai.com"');
    });
  });

  describe('accessibility', () => {
    it('includes a <main> landmark', () => {
      expect(renderLoginPage(baseOpts)).toContain('<main id="main-content">');
    });

    it('includes a skip link as the first focusable element', () => {
      const html = renderLoginPage(baseOpts);
      const skipIdx = html.indexOf('class="skip-link"');
      const mainIdx = html.indexOf('<main');
      expect(skipIdx).toBeGreaterThanOrEqual(0);
      expect(skipIdx).toBeLessThan(mainIdx);
    });

    it('labels both form inputs', () => {
      const html = renderLoginPage(baseOpts);
      expect(html.match(/<label>/g)?.length).toBeGreaterThanOrEqual(2);
      expect(html).toContain('autocomplete="email"');
      expect(html).toContain('autocomplete="current-password"');
    });

    it('exposes the error region as role="alert" only when error is set', () => {
      // The CSS selector `.error[role="alert"]` is always present in the
      // stylesheet; the assertion checks for the actual rendered element.
      expect(renderLoginPage(baseOpts)).not.toContain('<div class="error" role="alert">');
      expect(renderLoginPage({ ...baseOpts, error: 'Bad creds' })).toContain(
        '<div class="error" role="alert">Bad creds</div>',
      );
    });

    it('HTML-escapes the error text', () => {
      const html = renderLoginPage({
        ...baseOpts,
        error: '<script>x</script>',
      });
      expect(html).not.toContain('<script>x</script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('SSO scope deferral', () => {
    it('does NOT render Google or Apple SSO buttons in v1', () => {
      // Deferred per the U11 SSO decision (see login-page.ts module
      // header and docs/mcp/runbook.md). The follow-up PR can flip
      // `ssoEnabled: true` without changing this contract.
      const html = renderLoginPage({ ...baseOpts, ssoEnabled: true });
      expect(html).not.toMatch(/Sign in with Google/i);
      expect(html).not.toMatch(/Sign in with Apple/i);
      expect(html).not.toMatch(/\/login\/google/);
      expect(html).not.toMatch(/\/login\/apple/);
    });
  });
});
