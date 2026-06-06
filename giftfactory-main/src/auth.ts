import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

const getCleanUrl = (path: string) => {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://192.168.1.17:3000").replace(/\/+$/, "");
  const hasApiV1 = base.endsWith("/api/v1");
  const fullBase = hasApiV1 ? base : `${base}/api/v1`;
  return `${fullBase}${path.startsWith("/") ? "" : "/"}${path}`;
};

function getJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

const backendLoginUrl = getCleanUrl("/customer/login");

export const { auth, handlers, signIn, signOut } = NextAuth({
  secret:
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV === "development"
      ? "gift-factory-dev-secret-change-in-production"
      : undefined),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        otp: { label: "OTP", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        const c = credentials as Record<string, unknown>;

        // Signup: session created from tokens returned by otp-verification (no backend call)
        const signupToken = c._signup === "1" && c.accessToken;
        if (signupToken && c.refreshToken && c.userId) {
          return {
            id: String(c.userId),
            email: credentials.email,
            name: (c.name as string) || credentials.email,
            image: null,
            accessToken: c.accessToken as string,
            refreshToken: c.refreshToken as string,
            userId: String(c.userId),
          };
        }

        const useOtp = typeof credentials.otp === "string" && credentials.otp.length >= 6;

        try {
          if (useOtp) {
            const isPhone = /^[0-9+]+$/.test(String(credentials.email));
            const payload = isPhone
              ? { phone: credentials.email, otp: credentials.otp }
              : { email: credentials.email, otp: credentials.otp };
            const loginUrl = isPhone
              ? getCleanUrl("/customer/login-with-otp/by-phone")
              : getCleanUrl("/customer/login-with-otp/by-email");

            const res = await fetch(loginUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
              return null;
            }
            const data = json.data || json;
            const accessToken = json.accessToken || data.accessToken;
            const refreshToken = json.refreshToken || data.refreshToken;
            const userId = data._id ?? data.id ?? data.userId ?? data.customerId;
            const name = data.fullName || data.name || data.email;
            const email = data.email;
            if (!accessToken || !email) return null;
            return {
              id: String(userId),
              email,
              name: name ?? email,
              image: data.image ?? null,
              accessToken,
              refreshToken,
              userId: String(userId),
            };
          }

          if (!credentials?.password) return null;
          const res = await fetch(backendLoginUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            return null;
          }
          const data = json.data || json;
          const accessToken = json.accessToken || data.accessToken;
          const refreshToken = json.refreshToken || data.refreshToken;
          const userId = data._id ?? data.id ?? data.userId ?? data.customerId;
          const name = data.fullName || data.name || data.email;
          const email = data.email;
          if (!accessToken || !email) return null;
          return {
            id: String(userId),
            email,
            name: name ?? email,
            image: data.image ?? null,
            accessToken,
            refreshToken,
            userId: String(userId),
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as { userId?: string; id?: string; accessToken?: string; refreshToken?: string; name?: string };
        token.userId = u.userId ?? u.id;
        token.accessToken = u.accessToken;
        token.refreshToken = u.refreshToken;
        token.name = u.name;

        // Decode expiration
        const exp = u.accessToken ? getJwtExp(u.accessToken) : null;
        token.accessTokenExpires = exp ?? (Date.now() + 3600 * 1000); // fallback 1 hour
      }

      if (trigger === "update" && session) {
        if (session.user?.name) {
          token.name = session.user.name;
        }
        if (session.user?.image) {
          token.picture = session.user.image;
        }
      }

      // Check if access token is expired or close to expiring (within 5 minutes)
      const shouldRefresh = token.accessTokenExpires && (Date.now() + 5 * 60 * 1000 > (token.accessTokenExpires as number));

      if (shouldRefresh && token.refreshToken && token.userId) {
        try {
          const refreshUrl = getCleanUrl("/customer/refresh-token");
          const res = await fetch(refreshUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: token.userId,
              refreshToken: token.refreshToken,
            }),
          });

          if (res.ok) {
            const json = await res.json();
            const data = json.data || json;
            const newAccessToken = json.accessToken || data.accessToken;
            const newRefreshToken = json.refreshToken || data.refreshToken || token.refreshToken;

            if (newAccessToken) {
              token.accessToken = newAccessToken;
              token.refreshToken = newRefreshToken;
              const exp = getJwtExp(newAccessToken);
              token.accessTokenExpires = exp ?? (Date.now() + 3600 * 1000);
            }
          } else {
            console.warn("Failed to refresh access token, response status:", res.status);
          }
        } catch (err) {
          console.error("Error refreshing access token:", err);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.userId = token.userId as string;
      }
      session.accessToken = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
      session.userId = token.userId as string;

      // Fetch full user profile to get fullName
      if (token.accessToken) {
        try {
          const meRes = await fetch(getCleanUrl("/customer/me"), {
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${token.accessToken}`,
            },
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            const rawProfile = meData.data || meData;
            const profile = rawProfile?.customer ? rawProfile.customer : rawProfile;
            const profileName = profile.name || profile.fullName;
            if (profileName && session.user) {
              session.user.name = profileName;
            }
          }
        } catch (err) {
          console.error("Failed to fetch user profile in session:", err);
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/signup",
  },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
});
