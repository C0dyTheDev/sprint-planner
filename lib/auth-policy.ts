import { z } from 'zod';
import { isBootstrapAdmin } from './bootstrap';
import { readWorkspace } from './workspace-store';
import { verifyPassword, PASSWORD_MAX_LENGTH } from './credentials';

export async function canSignIn(email: string) {
  const workspace = await readWorkspace();
  return workspace
    ? workspace.state.members.some(member => member.email.toLowerCase() === email.toLowerCase())
    : isBootstrapAdmin(email);
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export async function authorizeCredentials(input: unknown) {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;
  // The password is checked first so failed attempts are throttled even for removed members.
  if (!await verifyPassword(email, password) || !await canSignIn(email)) return null;
  return { id: `user:${email}`, email, name: email };
}
