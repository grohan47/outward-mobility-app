import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SessionUser } from "./types";

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore=await cookies();
  const session=cookieStore.get("prism_session");
  if(!session) return null;
  try {
    const response=await fetch(`${process.env.FASTAPI_BASE_URL || "http://127.0.0.1:8000"}/api/auth/me`,{
      headers:{cookie:`prism_session=${session.value}`},cache:"no-store",
    });
    if(!response.ok)return null;
    return (await response.json()).user as SessionUser;
  }catch{return null;}
}
export async function requireSession(): Promise<SessionUser> {
  const session=await getSession();
  if(!session)redirect("/");
  return session;
}
