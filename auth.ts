import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { canSignIn, hasVerifiedGitHubEmail } from './lib/auth-policy';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub({ authorization: { params: { scope: 'read:user user:email' } } })],
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'github' || !account.access_token || !user.email) return false;
      try {
        return await hasVerifiedGitHubEmail(user.email, account.access_token) && await canSignIn(user.email);
      } catch {
        console.error('Sign-in authorization could not be checked');
        return false;
      }
    },
    async jwt({ token, account }) {
      if (account?.providerAccountId) token.userId = `github:${account.providerAccountId}`;
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.userId === 'string') session.user.id = token.userId;
      return session;
    },
  },
});
