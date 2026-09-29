"use client";

import { useTransition } from "react";
import { cancelBookingAction } from "./actions";

export function CancelBookingButton({ id, paid }: { id: string; paid: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn btn-small border-magenta text-magenta"
      disabled={pending}
      onClick={() => {
        const msg = paid
          ? "Cancel this booking and refund the customer in full? This frees the slot and removes the calendar event."
          : "Release this held slot?";
        if (!confirm(msg)) return;
        start(async () => {
          const res = await cancelBookingAction(id);
          if (res.error) alert(res.error);
        });
      }}
    >
      {pending ? "Working…" : paid ? "Cancel & refund" : "Release hold"}
    </button>
  );
}
