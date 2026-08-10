import Link from 'next/link';

export const metadata = {
  title: 'Support | PackRat',
  description:
    'Get help with PackRat — the mobile app, your account, and the Claude and ChatGPT connectors.',
};

export default function SupportPage() {
  return (
    <div className="container max-w-3xl py-12 px-4 md:px-6">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Support</h1>
          <p className="text-muted-foreground">
            Need a hand with PackRat? Here&apos;s how to reach us and where to find answers.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Contact us</h2>

          <div className="rounded-lg border p-6 bg-card space-y-4">
            <div>
              <h3 className="text-xl font-medium mb-1">Email</h3>
              <p>
                For any question, bug report, or feedback, email{' '}
                <a className="underline" href="mailto:support@packratai.com">
                  support@packratai.com
                </a>
                . We aim to reply within two business days.
              </p>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-xl font-medium mb-1">What to include</h3>
              <p className="mb-2">To help us resolve things on the first reply, please tell us:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>What you were trying to do, and what happened instead</li>
                <li>Where it happened — the iOS app, the web app, or a connector</li>
                <li>The email address on your PackRat account</li>
                <li>A screenshot, if the problem is something you can see</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Connectors</h2>
          <p>
            PackRat works inside Claude and ChatGPT, so you can plan trips, build packing lists, and
            search gear without leaving the conversation.
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <Link className="underline" href="/mcp">
                Connector setup and documentation
              </Link>{' '}
              — how to connect, what it can do, and the tools it exposes
            </li>
            <li>
              Connecting requires a free PackRat account. If sign-in fails, first confirm the email
              and password work in the app itself, then email us.
            </li>
            <li>
              A connector only ever reads and writes your own PackRat data plus the public gear
              catalog. Nothing is shared with other users.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Common questions</h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-medium mb-1">I forgot my password</h3>
              <p>
                Use <strong>Forgot password</strong> on the sign-in screen to get a reset link. If
                it doesn&apos;t arrive, check your spam folder before contacting us.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-1">My packs aren&apos;t syncing</h3>
              <p>
                PackRat saves changes locally first and syncs when you&apos;re back online. Confirm
                you have a connection and that you&apos;re signed in to the same account on both
                devices. If a pack is still missing after that, email us and we&apos;ll investigate.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-1">Weather looks wrong or missing</h3>
              <p>
                Forecasts cover the near term, so dates far in the future won&apos;t return a
                forecast. For a trip months out, expect seasonal guidance rather than a daily
                forecast.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-medium mb-1">A gear item is wrong or missing</h3>
              <p>
                The catalog is large and sourced from manufacturers and retailers, so specs can
                drift. Email us the product name and what&apos;s incorrect and we&apos;ll get it
                fixed.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Account and privacy</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <Link className="underline" href="/account-deletion">
                Delete your account
              </Link>{' '}
              — steps and what happens to your data
            </li>
            <li>
              <Link className="underline" href="/privacy-policy">
                Privacy policy
              </Link>
            </li>
            <li>
              <Link className="underline" href="/terms-of-service">
                Terms of service
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
