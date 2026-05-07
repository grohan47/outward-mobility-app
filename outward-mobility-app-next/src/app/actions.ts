"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";

const SESSION_COOKIE = "prism_session";

export async function loginAction() {
  return { error: "Use /api/auth/login from the client." };
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/");
}
