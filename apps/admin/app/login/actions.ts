'use server';

import { makeSessionToken } from 'admin-app/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function loginAction(formData: FormData) {
  const username = formData.get('username')?.toString() ?? '';
  const password = formData.get('password')?.toString() ?? '';
  const from = formData.get('from')?.toString() ?? '/dashboard';

  const validUsername = process.env.ADMIN_USERNAME ?? '';
  const validPassword = process.env.ADMIN_PASSWORD ?? '';

  if (!validUsername || !validPassword) {
    throw new Error('Admin credentials are not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD.');
  }

  if (username !== validUsername || password !== validPassword) {
    redirect(`/login?error=invalid&from=${encodeURIComponent(from)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set('admin-session', makeSessionToken(username, password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // 7 days
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect(from);
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('admin-session');
  redirect('/login');
}
