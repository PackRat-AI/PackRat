'use client';

import { Button } from '@packrat/web-ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@packrat/web-ui/components/card';
import { Input } from '@packrat/web-ui/components/input';
import { Label } from '@packrat/web-ui/components/label';
import { storeToken } from 'admin-app/lib/auth';
import { useCFAccessIdentity } from 'admin-app/lib/cfAccess';
import { Package, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE) {
  throw new Error('NEXT_PUBLIC_API_URL must be set (root .env.local → PUBLIC_API_URL)');
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const { data: cfIdentity, isPending: cfPending } = useCFAccessIdentity();

  useEffect(() => {
    if (!cfPending && cfIdentity) router.replace('/dashboard');
  }, [cfPending, cfIdentity, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await fetch(`${API_BASE}/api/admin/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${username}:${password}`)}`,
        },
      });

      if (res.status === 401) {
        setError('Invalid username or password.');
        return;
      }

      if (!res.ok) {
        setError('Could not reach the API. Check that the server is running.');
        return;
      }

      const { token } = (await res.json()) as { token: string };
      storeToken(token);
      router.replace('/dashboard');
    } catch {
      setError('Could not reach the API. Check that the server is running.');
    } finally {
      setPending(false);
    }
  }

  // Redirect in progress (behind CF Access) — show nothing while navigating
  if (!cfPending && cfIdentity) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/15 border border-primary/20">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">PackRat Admin</h1>
          <p className="text-sm text-muted-foreground">Enter your credentials to continue.</p>
        </div>

        <Card className="border-border/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Sign in</CardTitle>
            <CardDescription>Admin access only.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {!cfPending && !cfIdentity && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="w-3 h-3" />
            Local dev mode — Cloudflare Access not detected
          </p>
        )}
      </div>
    </div>
  );
}
