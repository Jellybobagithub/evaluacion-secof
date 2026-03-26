import { OAuth2Client } from "google-auth-library";
import { ENV } from "./env";

// Redirect URI debe coincidir exactamente con lo registrado en Google Cloud Console
export function getGoogleRedirectUri(origin: string): string {
  return `${origin}/api/auth/google/callback`;
}

export function createOAuth2Client(redirectUri: string) {
  return new OAuth2Client(
    ENV.googleClientId,
    ENV.googleClientSecret,
    redirectUri
  );
}

export function getGoogleAuthUrl(origin: string, state?: string): string {
  const redirectUri = getGoogleRedirectUri(origin);
  const client = createOAuth2Client(redirectUri);
  return client.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    state: state ?? origin,
    prompt: "select_account",
  });
}

export async function getGoogleUserInfo(code: string, origin: string) {
  const redirectUri = getGoogleRedirectUri(origin);
  const client = createOAuth2Client(redirectUri);
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token!,
    audience: ENV.googleClientId,
  });

  const payload = ticket.getPayload();
  if (!payload) throw new Error("No payload from Google token");

  return {
    googleId: payload.sub,
    email: payload.email ?? null,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
  };
}
