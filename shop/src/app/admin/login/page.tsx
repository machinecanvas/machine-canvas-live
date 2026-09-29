"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export default function AdminLogin() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { step: "email" });
  return (
    <div className="mx-auto max-w-sm">
      <p className="mono-label mb-3">Shop admin</p>
      <h1 className="mb-6 text-3xl">Sign in</h1>
      <form action={action} className="space-y-4">
        {state.step === "email" ? (
          <label className="block">
            <span className="mono-label label">Email</span>
            <input name="email" type="email" required autoComplete="email" className="field" />
          </label>
        ) : (
          <label className="block">
            <span className="mono-label label">Code sent to {state.email}</span>
            <input name="code" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9 ]{6,10}" className="field font-mono tracking-[0.4em]" />
          </label>
        )}
        {state.message && <p className="text-sm text-zinc-400">{state.message}</p>}
        <button className="btn btn-cyan w-full" disabled={pending}>
          {pending ? "…" : state.step === "email" ? "Email me a code" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
