
import NextAuth from "next-auth"
import AzureADProvider from "next-auth/providers/azure-ad";
import Credentials from "next-auth/providers/credentials"


export const { handlers, auth, signIn, signOut } = NextAuth({
    secret: process.env.AUTH_SECRET,
    providers: [
        AzureADProvider({
            clientId: process.env.AZURE_AD_CLIENT_ID,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
            issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,


            authorization: {
                params: {
                    scope: "openid profile email"
                }
            },
            profile(profile) {
                return {
                    id: profile.oid || profile.sub,
                    email: profile.preferred_username || profile.email || "",
                    name: profile.name,
                    role: "User",
                    azureData: profile,
                };
            },
        }),
        Credentials({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                const username = process.env.AUTH_USERNAME || "admin";
                const password = process.env.AUTH_PASSWORD || "admin";

                if (
                    credentials?.username === username &&
                    credentials?.password === password
                ) {
                    return { id: "1", name: "Admin User", email: "admin@example.com" };
                }
                return null;
            },
        }),
    ],
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnLogin = nextUrl.pathname.startsWith("/login");
            const isPublicAsset = nextUrl.pathname.match(
                /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/
            );

            if (isPublicAsset) return true;

            if (isOnLogin) {
                if (isLoggedIn) {
                    return Response.redirect(new URL("/", nextUrl));
                }
                return true;
            }

            if (!isLoggedIn) {
                return false;
            }

            return true;
        },
    },
    pages: {
        signIn: "/login",
    },
})
