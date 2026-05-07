import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SessionUser } from "./types";

const SESSION_COOKIE = "prism_session";

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session?.value) return null;

  try {
    return JSON.parse(decodeURIComponent(session.value)) as SessionUser;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }
  return session;
}
