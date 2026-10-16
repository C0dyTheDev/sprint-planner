import { auth } from '@/auth';

export async function getCurrentUser() {
  const session = await auth();
  const user = session?.user;
  if (!user?.email || !user.id) return null;
  return { userId: user.id, email: user.email.toLowerCase(), fullName: user.name ?? null, displayName: user.name ?? user.email };
}
