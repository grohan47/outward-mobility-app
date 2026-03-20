import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SessionUser } from "./types";

const SESSION_COOKIE = "prism_session";

export function getSession(): SessionUser | null {
  const cookieStore = cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session?.value) return null;

  try {
    return JSON.parse(decodeURIComponent(session.value)) as SessionUser;
  } catch {
    return null;
  }
}

export function requireSession(): SessionUser {
  const session = getSession();
  if (!session) {
    redirect("/");
  }
  return session;
}
