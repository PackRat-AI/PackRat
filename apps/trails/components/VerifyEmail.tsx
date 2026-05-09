'use client';

import { OTPInput, REGEXP_ONLY_DIGITS } from 'input-otp';
import { Loader2, Mail } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from 'trails-app/lib/useAuth';

export function VerifyEmail() {
  const { pendingEmail, verifyEmail, resendVerification } = useAuth();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleComplete = useCallback(
    async (value: string) => {
      setLoading(true);
      try {
        await verifyEmail(value);
        toast.success('Email verified! Search unlocked.');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Invalid code. Try again.');
        setOtp('');
      } finally {
        setLoading(false);
      }
    },
    [verifyEmail],
  );

  const handleResend = useCallback(async () => {
    try {
      await resendVerification();
      setResendCooldown(60);
      toast.success('Verification email sent!');
    } catch {
      toast.error('Failed to resend. Try again.');
    }
  }, [resendVerification]);

  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Mail className="h-6 w-6 text-primary" />
      </div>
      <div>
        <p className="font-medium">Check your email</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a 6-digit code to{' '}
          <span className="font-medium text-foreground">{pendingEmail}</span>
        </p>
      </div>

      <OTPInput
        maxLength={6}
        pattern={REGEXP_ONLY_DIGITS}
        value={otp}
        onChange={setOtp}
        onComplete={handleComplete}
        disabled={loading}
        containerClassName="flex gap-2"
        render={({ slots }) => (
          <>
            {slots.map((slot, i) => (
              <div
                key={i}
                className="flex h-12 w-10 items-center justify-center rounded-md border border-input bg-background text-lg font-mono shadow-sm transition-all focus-within:border-primary"
              >
                {slot.char ??
                  (slot.isActive ? (
                    <span className="animate-pulse text-muted-foreground">|</span>
                  ) : null)}
              </div>
            ))}
          </>
        )}
      />

      {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

      <div className="text-sm text-muted-foreground">
        {"Didn't receive it? "}
        {resendCooldown > 0 ? (
          <span>Resend in {resendCooldown}s</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            className="text-primary underline-offset-4 hover:underline"
          >
            Resend
          </button>
        )}
      </div>
    </div>
  );
}
