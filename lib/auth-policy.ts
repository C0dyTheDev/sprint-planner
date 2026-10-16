import { isBootstrapAdmin } from './bootstrap';
import { readWorkspace } from './workspace-store';

export async function canSignIn(email: string) {
  const workspace = await readWorkspace();
  return workspace
    ? workspace.state.members.some(member => member.email.toLowerCase() === email.toLowerCase())
    : isBootstrapAdmin(email);
}

export async function hasVerifiedGitHubEmail(email: string, accessToken: string) {
  const response = await fetch('https://api.github.com/user/emails', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    cache: 'no-store',
  });
  if (!response.ok) return false;
  const addresses: unknown = await response.json();
  return Array.isArray(addresses) && addresses.some(item =>
    typeof item?.email === 'string' && item.verified === true && item.email.toLowerCase() === email.toLowerCase());
}
