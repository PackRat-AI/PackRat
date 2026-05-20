'use client';

import { Mail } from 'lucide-react';

export function VerifyEmail({ email }: { email: string }) {
  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Mail className="h-6 w-6 text-primary" />
      </div>
      <div>
        <p className="font-medium">Check your email</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a verification link to{' '}
          <span className="font-medium text-foreground">{email}</span>. Click the link to verify
          your account.
        </p>
      </div>
    </div>
  );
}
