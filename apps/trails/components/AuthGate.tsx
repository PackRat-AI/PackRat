'use client';

import { makeEnumGuard } from '@packrat/guards';
import { Button } from '@packrat/web-ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@packrat/web-ui/components/dialog';
import { Input } from '@packrat/web-ui/components/input';
import { Label } from '@packrat/web-ui/components/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@packrat/web-ui/components/tabs';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from 'trails-app/lib/useAuth';

const TABS = ['register', 'login', 'forgot'] as const;
type Tab = (typeof TABS)[number];
const isTab = makeEnumGuard(TABS);

export function AuthGate() {
  const { authGateOpen, closeAuthGate, register, login, forgotPassword } = useAuth();
  const [tab, setTab] = useState<Tab>('register');
  const [loading, setLoading] = useState(false);

  // Register form
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regFirstName, setRegFirstName] = useState('');

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Forgot form
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await register(regEmail, { password: regPassword, firstName: regFirstName || undefined });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exists')) {
        toast.error('Account already exists.', {
          action: { label: 'Log in', onClick: () => setTab('login') },
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginEmail, loginPassword);
      toast.success('Logged in! Search unlocked.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(forgotEmail);
      setForgotSent(true);
    } catch {
      toast.error('Could not send reset email. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={authGateOpen} onOpenChange={(open) => !open && closeAuthGate()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Search trails on PackRat</DialogTitle>
          <DialogDescription>
            Create a free account to search trails by name or location.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            if (isTab(v)) setTab(v);
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="register">Create account</TabsTrigger>
            <TabsTrigger value="login">Log in</TabsTrigger>
          </TabsList>

          <TabsContent value="register">
            <form onSubmit={handleRegister} className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reg-name">Name (optional)</Label>
                <Input
                  id="reg-name"
                  placeholder="Trail Blazer"
                  value={regFirstName}
                  onChange={(e) => setRegFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reg-email">Email</Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="you@example.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reg-password">Password</Label>
                <Input
                  id="reg-password"
                  type="password"
                  placeholder="Min 8 characters"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create free account
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                By creating an account you agree to our{' '}
                <a
                  href="https://packratai.com/terms"
                  className="underline underline-offset-4 hover:text-foreground"
                  target="_blank"
                  rel="noreferrer"
                >
                  Terms
                </a>{' '}
                and{' '}
                <a
                  href="https://packratai.com/privacy"
                  className="underline underline-offset-4 hover:text-foreground"
                  target="_blank"
                  rel="noreferrer"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </form>
          </TabsContent>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setTab('forgot')}
                    className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="Your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Log in
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="forgot">
            {forgotSent ? (
              <div className="mt-4 flex flex-col items-center gap-4 text-center">
                <p className="font-medium">Check your inbox</p>
                <p className="text-sm text-muted-foreground">
                  We sent a password reset link to{' '}
                  <span className="font-medium text-foreground">{forgotEmail}</span>.
                </p>
                <Button variant="outline" onClick={() => setTab('login')}>
                  Back to log in
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="mt-4 flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Enter your email and we'll send you a link to reset your password.
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send reset link
                </Button>
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Back to log in
                </button>
              </form>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
