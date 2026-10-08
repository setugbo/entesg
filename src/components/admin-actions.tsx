"use client";
import { useState, useTransition } from "react";
import { resetUserPassword } from "@/server/records";

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  const [temp, setTemp] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-1">
      <button
        disabled={pending}
        onClick={() => start(async () => {
          const t = (await resetUserPassword(userId)) as unknown as string | void;
          setTemp(typeof t === "string" ? t : null);
        })}
        className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold hover:bg-slate-50 disabled:opacity-50"
        title="Generate a temporary password"
      >
        {pending ? "…" : "Reset pw"}
      </button>
      {temp && <code className="rounded bg-amber-50 px-1 text-[11px] text-amber-900">{temp}</code>}
    </span>
  );
}
