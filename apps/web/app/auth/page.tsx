'use client';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useState } from 'react';
import { setTokens } from 'web-app/lib/auth';
import { getApiBaseUrl } from 'web-app/lib/getApiBaseUrl';

const API_BASE = getApiBaseUrl();

function useLoginMutation() {
  return useMutation({
    mutationFn: async (body: { email: string; password: string }) => {
      const res = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Login failed');
      return res.json() as Promise<{ token?: string; user?: unknown }>;
    },
  });
}

function useRegisterMutation() {
  return useMutation({
    mutationFn: async (body: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
    }) => {
      const name = [body.firstName, body.lastName].filter(Boolean).join(' ') || body.email;
      const res = await fetch(`${API_BASE}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: body.email, password: body.password, name }),
      });
      if (!res.ok) throw new Error('Registration failed');
      return res.json();
    },
  });
}

export default function AuthPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const router = useRouter();

  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setInfo(null);
    loginMutation.mutate(
      { email, password },
      {
        onSuccess: (data) => {
          const token = (data as { token?: string }).token ?? '';
          if (!token) return;
          setTokens({ accessToken: token, refreshToken: '' });
          router.push('/');
        },
      },
    );
  }

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setInfo(null);
    const [firstName, ...rest] = username.trim().split(' ');
    const lastName = rest.join(' ') || undefined;
    registerMutation.mutate(
      { email, password, firstName: firstName ?? username, lastName },
      {
        onSuccess: () => {
          setTab('login');
          setInfo('Account created! Please check your email to verify, then sign in.');
        },
      },
    );
  }

  const loginError = loginMutation.error?.message ?? null;
  const registerError = registerMutation.error?.message ?? null;

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
            {loginError && <p className="text-sm text-destructive">{loginError}</p>}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
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
            {registerError && <p className="text-sm text-destructive">{registerError}</p>}
            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {registerMutation.isPending ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
