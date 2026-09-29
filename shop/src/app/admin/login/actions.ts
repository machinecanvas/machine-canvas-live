"use server";

import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/admin/auth";
import { rateLimit } from "@/lib/rate-limit";
import { supabaseServer } from "@/lib/supabase/server";

export type LoginState = { step: "email" | "code"; email?: string; message?: string };

export async function loginAction(prev: LoginState, form: FormData): Promise<LoginState> {
  if (!(await rateLimit("admin-login", 10, 15 * 60))) {
    return { ...prev, message: "Too many attempts. Please wait 15 minutes." };
  }
  const supabase = await supabaseServer();

  if (prev.step === "email") {
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    // Same response whether or not the email is allowed, so the allow-list can't be probed.
    if (isAdminEmail(email)) {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) {
        console.error("admin otp failed", error);
        return { step: "email", message: "Couldn't send the code. Please try again shortly." };
      }
    }
    return { step: "code", email, message: "If that address is an admin, a 6-digit sign-in code is on its way." };
  }

  const email = prev.email ?? "";
  const token = String(form.get("code") ?? "").replace(/\s/g, "");
  if (!isAdminEmail(email)) return { step: "code", email, message: "That code isn't valid." };
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { step: "code", email, message: "That code isn't valid or has expired." };
  redirect("/admin");
}

export async function logoutAction() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
