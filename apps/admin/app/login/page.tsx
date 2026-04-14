import { loginAction } from './actions';
import { AlertCircle, Package } from 'lucide-react';

interface LoginPageProps {
  searchParams: Promise<{ error?: string; from?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, from } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {/* Subtle gradient backdrop */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />

      <div className="relative w-full max-w-sm px-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <Package className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">PackRat Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your admin account</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border bg-card shadow-apple-lg p-8">
          {error === 'invalid' && (
            <div className="flex items-center gap-2 mb-6 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Invalid username or password.</span>
            </div>
          )}

          <form action={loginAction} className="space-y-4">
            <input type="hidden" name="from" value={from ?? '/dashboard'} />

            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-sm font-medium">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors
                           placeholder:text-muted-foreground
                           focus:ring-2 focus:ring-ring focus:border-ring"
                placeholder="admin"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors
                           placeholder:text-muted-foreground
                           focus:ring-2 focus:ring-ring focus:border-ring"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-semibold
                         hover:bg-primary/90 active:scale-[0.98] transition-all"
            >
              Sign in
            </button>
          </form>
        </div>

        {/* Cloudflare Access note */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          In production, access is controlled by Cloudflare Zero Trust.
        </p>
      </div>
    </div>
  );
}
