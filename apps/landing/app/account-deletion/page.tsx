import Link from "next/link";

export const metadata = {
  title: "Account Deletion | PackRat",
  description: "Instructions for deleting your PackRat account and associated data.",
};

export default function AccountDeletionPage() {
  return (
    <div className="container max-w-3xl py-12 px-4 md:px-6">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Account Deletion</h1>
          <p className="text-muted-foreground">
            Instructions for deleting your PackRat account and associated data
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">How to Delete Your Account</h2>

          <div className="rounded-lg border p-6 bg-card">
            <h3 className="text-xl font-medium mb-4">For logged-in users:</h3>
            <ol className="list-decimal pl-6 space-y-3">
              <li>Open the PackRat app.</li>
              <li>From dashboard click the settings icon at the header to go to Settings.</li>
              <li>
                Tap <strong>Delete Account</strong> and confirm.
              </li>
            </ol>

            <div className="border-t my-6"></div>

            <h3 className="text-xl font-medium mb-4">For logged-out users:</h3>
            <p>Reinstall the app, log in, and follow the steps above.</p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Data Deletion Information</h2>
          <p>
            When you delete your account, the following data will be permanently removed from our
            systems:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Your profile information (name, email, username)</li>
            <li>Your pack lists and all associated items</li>
            <li>Your saved preferences and settings</li>
            <li>Your usage history within the app</li>
          </ul>

          <div className="mt-4">
            <h3 className="text-xl font-medium mb-2">Data Retention</h3>
            <p>Some information may be retained for a limited period after account deletion:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Backup data:</strong> May be retained for up to 30 days before being
                permanently deleted from our backup systems.
              </li>
              <li>
                <strong>Analytics data:</strong> Anonymized usage data may be retained for
                analytical purposes but cannot be linked back to your identity.
              </li>
              <li>
                <strong>Legal compliance:</strong> Information required to be kept for legal or
                regulatory purposes may be retained for the required period.
              </li>
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Need Help?</h2>
          <p>
            If you're having trouble deleting your account or have questions about data deletion,
            please contact our support team at{" "}
            <Link href="mailto:support@packratai.com" className="text-primary hover:underline">
              support@packratai.com
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
