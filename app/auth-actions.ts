'use server';
import { AuthError } from 'next-auth';
import { signIn, signOut } from '@/auth';

export async function login(_previous: string | undefined, form: FormData) {
  try {
    await signIn('credentials', { email: form.get('email'), password: form.get('password'), redirectTo: '/' });
  } catch (error) {
    // A successful sign-in throws Next.js's redirect, which must propagate.
    if (!(error instanceof AuthError)) throw error;
    if (error.type === 'CredentialsSignin') return 'Incorrect email or password.';
    console.error('Sign-in could not be checked', error.type);
    return 'Sign-in is temporarily unavailable. Please try again.';
  }
}

export async function logout() {
  await signOut({ redirectTo: '/' });
}
