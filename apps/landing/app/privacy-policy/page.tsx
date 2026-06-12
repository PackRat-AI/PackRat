import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | PackRat',
  description: 'Our privacy policy explains how we collect, use, and protect your information.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container max-w-3xl py-12 px-4 md:px-6">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: May 31, 2026</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Introduction</h2>
          <p>
            This Privacy Policy explains how PackRat ("we", "us", or "our") collects, uses, and
            shares your personal information when you use our application and related services. We
            respect your privacy and are committed to protecting your personal data.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Information Collected</h2>
          <p>We collect the following types of information:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Personal identifiers (name, email address, username)</li>
            <li>Device information (device type, operating system)</li>
            <li>Usage data (interactions with the app, features used)</li>
            <li>Location data (if permitted by you)</li>
            <li>User content (pack lists, item details, notes)</li>
          </ul>
          <p>We collect this information through:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Direct interactions (when you create an account or profile)</li>
            <li>Automated technologies (cookies, analytics tools)</li>
            <li>Third-party services (authentication providers)</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">How the Data is Used</h2>
          <p>We use your personal information for the following purposes:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>To provide and maintain our service</li>
            <li>To create and manage your account</li>
            <li>To personalize your experience</li>
            <li>To improve our app and develop new features</li>
            <li>To communicate with you about updates or changes</li>
            <li>To analyze usage patterns and optimize performance</li>
          </ul>
          <p>The legal basis for processing your data includes:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Your consent</li>
            <li>Performance of our contract with you</li>
            <li>Our legitimate business interests</li>
            <li>Compliance with legal obligations</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Data Sharing & Disclosure</h2>
          <p>We may share your information with:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Service providers (hosting, database management, analytics)</li>
            <li>Business partners (with your consent)</li>
            <li>Legal authorities (when required by law)</li>
          </ul>
          <p>We may also disclose your information:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>In response to legal requests</li>
            <li>To protect our rights, privacy, safety, or property</li>
            <li>In connection with a business transfer or acquisition</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Cookies & Tracking Technologies</h2>
          <p>Our app uses cookies and similar tracking technologies to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Remember your preferences</li>
            <li>Analyze how you use our app</li>
            <li>Improve functionality and performance</li>
          </ul>
          <p>
            You can manage cookie preferences through your browser settings. However, disabling
            certain cookies may limit functionality.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            MCP Connector & Third-Party Clients
          </h2>
          <p>
            PackRat operates a Model Context Protocol (MCP) connector at{' '}
            <code className="text-sm">mcp.packratai.com</code> that lets you connect MCP-capable
            clients (for example, Claude.ai) to your PackRat account. This section explains how we
            handle data on that surface.
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>OAuth tokens.</strong> When you connect an MCP client we store the OAuth
              refresh token at rest in Cloudflare KV, which encrypts data at rest. Access tokens are
              short-lived (60 minutes); refresh tokens last 30 days and rotate on use.
            </li>
            <li>
              <strong>What the MCP client sees.</strong> Only the data the scopes you approved
              authorize. <code className="text-sm">mcp:read</code> exposes read-only tools,{' '}
              <code className="text-sm">mcp:write</code> adds create/update/delete, and{' '}
              <code className="text-sm">mcp:admin</code> is granted only to PackRat admin users.
            </li>
            <li>
              <strong>What the MCP client does NOT see.</strong> The MCP client never sees your
              PackRat password — sign-in is handled directly by our authentication service. We do
              not log the conversation content you send to MCP clients; we only see the tool calls
              those clients make against PackRat.
            </li>
            <li>
              <strong>Retention.</strong> OAuth grants are deleted automatically when the refresh
              token expires, and immediately when you revoke the connection from your PackRat
              account or by emailing us.
            </li>
            <li>
              <strong>Third-party clients.</strong> When you connect a third-party MCP client (e.g.,
              Claude.ai) to PackRat, that client's own privacy policy governs how it handles the
              PackRat data it receives. We are not responsible for the data practices of MCP clients
              we do not operate.
            </li>
            <li>
              <strong>Deletion.</strong> To delete your PackRat account, or to revoke just the MCP
              OAuth grants without deleting your account, use the account-settings flow in the app
              or contact us at{' '}
              <Link href="mailto:hello@packratai.com" className="text-primary hover:underline">
                hello@packratai.com
              </Link>
              .
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">User Rights & Choices</h2>
          <p>Depending on your location, you may have the following rights:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Delete your personal data</li>
            <li>Object to or restrict processing</li>
            <li>Data portability</li>
            <li>Withdraw consent</li>
          </ul>
          <p>
            To exercise these rights, please contact us using the information provided in the
            "Contact Information" section.
          </p>
          <p className="mt-2">
            To delete your account and associated data, please visit our{' '}
            <Link href="/account-deletion" className="text-primary font-medium hover:underline">
              Account Deletion page
            </Link>{' '}
            for step-by-step instructions.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Data Security Measures</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your personal
            data, including encryption, secure servers, regular security assessments, and access
            controls. However, no method of transmission over the Internet or electronic storage is
            100% secure, so we cannot guarantee absolute security.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Data Retention Period</h2>
          <p>
            We retain your personal data only for as long as necessary to fulfill the purposes for
            which it was collected, including legal, accounting, or reporting requirements. When
            determining retention periods, we consider the amount, nature, and sensitivity of the
            data, the potential risk of harm from unauthorized use or disclosure, and applicable
            legal requirements.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">International Data Transfers</h2>
          <p>
            Your information may be transferred to and processed in countries other than your
            country of residence. These countries may have different data protection laws. When we
            transfer your data internationally, we take appropriate safeguards to ensure your
            information remains protected in accordance with this Privacy Policy and applicable law.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Children's Privacy</h2>
          <p>
            Our service is not intended for children under the age of 13. We do not knowingly
            collect personal information from children under 13. If you are a parent or guardian and
            believe your child has provided us with personal information, please contact us, and we
            will take steps to delete such information.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Policy Updates</h2>
          <p>
            We may update this Privacy Policy from time to time to reflect changes in our practices
            or for other operational, legal, or regulatory reasons. We will notify you of any
            material changes by posting the new Privacy Policy on this page and updating the "Last
            Updated" date. You are advised to review this Privacy Policy periodically for any
            changes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Contact Information</h2>
          <p>
            If you have any questions about this Privacy Policy or our data practices, please
            contact us at:
          </p>
          <p>
            Email:{' '}
            <Link href="mailto:privacy@packratai.com" className="text-primary hover:underline">
              privacy@packratai.com
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
