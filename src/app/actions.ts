"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, getSessionCookieName } from "@/lib/session";

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string;

  if (!email || !email.includes("@")) {
    return { error: "Please enter a valid email address." };
  }

  const session = createSession(email.toLowerCase().trim());

  if (!session) {
    return {
      error: `No account found for "${email}". Try one of the demo accounts listed below.`,
    };
  }

  // Set session cookie
  const cookieStore = cookies();
  cookieStore.set(getSessionCookieName(), JSON.stringify(session), {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });

  // Redirect based on role
  switch (session.role) {
    case "STUDENT":
      redirect("/generator");
    case "OGE_ADMIN":
      redirect("/admin");
    case "STUDENT_LIFE":
    case "PROGRAM_CHAIR":
    case "DEAN_ACADEMICS":
      redirect("/reviewer");
    default:
      redirect("/");
  }
}

export async function logoutAction() {
  const cookieStore = cookies();
  cookieStore.delete(getSessionCookieName());
  redirect("/");
}
