'use client';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useState } from 'react';
import { authClient } from 'web-app/lib/auth-client';

export default function AuthPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      const { error: authError } = await authClient.signIn.email({ email, password });
      if (authError) throw new Error(authError.message ?? 'Login failed');
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsPending(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      const { error: authError } = await authClient.signUp.email({
        email,
        password,
        name: username || email,
      });
      if (authError) throw new Error(authError.message ?? 'Registration failed');
      setTab('login');
      setInfo('Account created! Please check your email to verify, then sign in.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-6 bg-[#1c1c1e] rounded-2xl shadow-xl">
        <div className="flex items-center gap-2 justify-center mb-2">
          <span className="text-2xl font-bold text-foreground">PackRat</span>
        </div>
        <div className="flex gap-2 bg-accent rounded-xl p-1">
          <button
            type="button"
            onClick={() => setTab('login')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'login' ? 'bg-background text-foreground' : 'text-muted-foreground'}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setTab('register')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'register' ? 'bg-background text-foreground' : 'text-muted-foreground'}`}
          >
            Create Account
          </button>
        </div>
        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            {info && <p className="text-sm text-green-400">{info}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <input
              type="text"
              placeholder="Name or username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            <input
              type="password"
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
              minLength={8}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
