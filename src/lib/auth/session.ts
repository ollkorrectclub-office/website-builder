import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "bldr_session";
const SESSION_DURATION_DAYS = 30;

function expiresAtDate() {
  return new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

export function buildSessionExpiryIso() {
  return expiresAtDate().toISOString();
}

export async function readSessionToken() {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
}

export async function writeSessionCookie(sessionToken: string, expiresAt: string) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
