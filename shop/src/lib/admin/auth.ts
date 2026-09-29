import "server-only";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && env.adminEmails().includes(email.toLowerCase());
}

/** Returns the admin's email, or redirects to the login page. */
export async function requireAdmin(): Promise<string> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!isAdminEmail(email)) redirect("/admin/login");
  return email!;
}
