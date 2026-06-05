/**
 * Terms of Service — TEMPLATE pending legal review.
 *
 * This page is shipped to unblock the Claude Connector Store submission
 * (Anthropic's Software Directory Policy treats a published ToS + Privacy
 * Policy as a listing prerequisite). The copy is operator-drafted plain
 * language, not bar-vetted legalese.
 *
 * Operator TODOs before treating this as authoritative:
 *   - Have counsel review every section, especially: limitation of liability,
 *     governing-law selection, MCP-connector provisions, age-of-eligibility,
 *     and the connector-driven-output disclaimer.
 *   - Set the governing jurisdiction in the "Governing law" section below
 *     (currently flagged with a TODO comment).
 *   - Decide whether the 16-and-up eligibility threshold matches your
 *     COPPA / GDPR-K obligations for users in regulated regions.
 *   - Confirm that the MCP-connector subsection accurately matches what the
 *     Worker currently does (scopes, rate limits, revocation path).
 *
 * If anything in here drifts from product behavior, fix the copy first,
 * then re-version + re-publish.
 */

import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | PackRat',
  description:
    'The terms that govern your use of PackRat, including outdoor adventure planning features and MCP connector access.',
  // TEMPLATE pending legal review (see file header) — keep out of search
  // indexes until counsel signs off and operator TODOs are resolved.
  robots: { index: false, follow: false },
};

export default function TermsOfServicePage() {
  return (
    <div className="container max-w-3xl py-12 px-4 md:px-6">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-muted-foreground">Effective: May 22, 2026</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Introduction</h2>
          <p>
            These Terms of Service ("Terms") govern your use of PackRat ("we", "us", "our") — the
            mobile app, web app, public APIs, and the PackRat MCP connector. By creating an account
            or otherwise using PackRat you agree to these Terms. If you do not agree, do not use the
            service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Eligibility & Accounts</h2>
          <p>
            You must be at least 16 years old to create a PackRat account (older where your local
            law requires it). You are responsible for the activity that happens under your account,
            for keeping your sign-in credentials safe, and for the accuracy of the information you
            provide. If you suspect your account has been compromised, contact us immediately at{' '}
            <Link href="mailto:hello@packratai.com" className="text-primary hover:underline">
              hello@packratai.com
            </Link>
            .
          </p>
          <p>
            One account per person. You may not create accounts on behalf of someone else without
            their explicit permission, or use an account in a way that misrepresents who you are.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Acceptable Use</h2>
          <p>
            PackRat is built to help you plan and track outdoor trips — packing lists, trail data,
            weather forecasts, trip notes, and similar planning tools. You may use it for personal,
            educational, or commercial outdoor-planning purposes. You may not:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Scrape or bulk-download data outside the documented API rate limits.</li>
            <li>
              Upload illegal content, content you do not have the right to share, or content that
              targets, harasses, or endangers another person.
            </li>
            <li>Attempt to access, interfere with, or degrade other users' accounts or data.</li>
            <li>Probe, scan, or attempt to circumvent any security or authentication mechanism.</li>
            <li>
              Use PackRat to send unsolicited messages or to operate any kind of automated abuse.
            </li>
          </ul>
          <p>
            We may suspend or revoke access for any account that violates these rules, with or
            without notice depending on the severity.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">MCP Connector & API Access</h2>
          <p>
            PackRat exposes a Model Context Protocol (MCP) connector at{' '}
            <code className="text-sm">mcp.packratai.com</code> that lets MCP-capable clients (for
            example, Claude.ai) read and write your PackRat data on your behalf. The following terms
            apply specifically to that surface:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Connecting an MCP client to PackRat uses OAuth 2.1. The flow requires you to grant one
              or more scopes — <code className="text-sm">mcp:read</code>,{' '}
              <code className="text-sm">mcp:write</code>, or{' '}
              <code className="text-sm">mcp:admin</code>. The client only receives the scopes you
              approve. The <code className="text-sm">mcp:admin</code> scope is granted only to users
              with a PackRat admin role.
            </li>
            <li>
              Tool calls are rate-limited at both the zone and per-user/per-tool level. Sustained
              abuse — or any pattern that materially degrades the service for other users — may
              result in tokens being revoked and the client being blocked.
            </li>
            <li>
              MCP clients are independent software. PackRat is not responsible for the output an MCP
              client (or its underlying model) produces based on PackRat data, including any
              suggestions, summaries, or actions the client recommends. Treat MCP-client output as
              advisory, not authoritative.
            </li>
            <li>
              You can revoke a connected MCP client at any time from your PackRat account settings,
              or by contacting{' '}
              <Link href="mailto:hello@packratai.com" className="text-primary hover:underline">
                hello@packratai.com
              </Link>
              . Revocation invalidates the OAuth refresh token and stops new access tokens from
              being issued; previously issued access tokens expire on their normal short timer.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Outdoor Safety Disclaimer</h2>
          <p>
            Outdoor adventure planning has inherent risks. PackRat — including trail data, weather
            forecasts, wildlife notes, route estimates, and any AI- or LLM-generated suggestion — is
            informational only and is not a substitute for current local conditions, certified
            guides, official ranger advisories, or your own judgment. You are responsible for the
            decisions you make about your safety and the safety of anyone with you. Carry
            appropriate backup navigation, communication, and emergency gear, and check official
            sources before you go.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Fees</h2>
          <p>
            PackRat is free to use. There are no subscription fees, in-app purchases, or paid tiers,
            so there is no refund policy. The service is provided as-is and as-available; we do not
            commit to a specific uptime, response time, or feature set.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Termination</h2>
          <p>
            You may stop using PackRat and delete your account at any time. See our{' '}
            <Link href="/account-deletion" className="text-primary font-medium hover:underline">
              Account Deletion page
            </Link>{' '}
            for the in-app and contact-based deletion paths.
          </p>
          <p>
            We may suspend or terminate an account if it violates these Terms, if continued service
            would expose us or other users to risk, or if we are required to by law. Where possible
            we will give notice and a chance to fix the issue first.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, PackRat is provided "as is" without warranty of
            any kind. We are not liable for indirect, incidental, consequential, special, or
            punitive damages, or for lost profits, lost data, or business interruption arising from
            your use of the service. Our total aggregate liability for any claim related to PackRat
            is capped at the amount you have paid us in the prior twelve months — which, because the
            service is free, is zero dollars (USD $0).
          </p>
          <p>
            Some jurisdictions do not allow the exclusion of certain warranties or the limitation of
            liability for consequential or incidental damages. In those jurisdictions, the above
            limits apply to the maximum extent permitted by law.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Governing Law</h2>
          {/* TODO(operator): set jurisdiction — replace this paragraph with the chosen US state's
              choice-of-law and venue clause once legal review is complete. The placeholder below
              defaults to the State of Delaware and the federal/state courts located there. */}
          <p>
            These Terms are governed by the laws of the United States and the State of Delaware,
            without regard to its conflict-of-laws rules. Any dispute that cannot be resolved
            informally will be brought exclusively in the state or federal courts located in
            Delaware, and you and PackRat each consent to that venue.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. If a change is material, we will notify you
            by email or with an in-app notice before the change takes effect. Continued use of
            PackRat after the effective date constitutes acceptance of the updated Terms. The most
            recent version is always published at{' '}
            <Link href="/terms-of-service" className="text-primary hover:underline">
              packratai.com/terms-of-service
            </Link>
            .
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Contact</h2>
          <p>Questions about these Terms, abuse reports, security issues, or account problems:</p>
          <p>
            Email:{' '}
            <Link href="mailto:hello@packratai.com" className="text-primary hover:underline">
              hello@packratai.com
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
