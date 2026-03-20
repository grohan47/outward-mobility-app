import { cookies } from "next/headers";
import { getDb } from "./db";
import { ensureDbInitialized } from "./schema";
import type { SessionUser, User, Role } from "./types";

const SESSION_COOKIE = "prism_session";

export function getSession(): SessionUser | null {
  ensureDbInitialized();
  const cookieStore = cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session?.value) return null;

  try {
    return JSON.parse(session.value) as SessionUser;
  } catch {
    return null;
  }
}

export function requireSession(): SessionUser {
  const session = getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export function createSession(email: string): SessionUser | null {
  ensureDbInitialized();
  const db = getDb();

  const user = db
    .prepare(
      `SELECT u.id, u.email, u.full_name, r.code as role_code, r.display_name as role_display_name
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE u.email = ? AND u.is_active = 1
       LIMIT 1`
    )
    .get(email) as
    | {
        id: number;
        email: string;
        full_name: string;
        role_code: string;
        role_display_name: string;
      }
    | undefined;

  if (!user) return null;

  const session: SessionUser = {
    email: user.email,
    name: user.full_name,
    role: user.role_code,
    roleDisplayName: user.role_display_name,
    userId: user.id,
  };

  return session;
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}
