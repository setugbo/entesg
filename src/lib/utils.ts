import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number | string | null | undefined, digits = 2) {
  if (n === null || n === undefined || n === "") return "—";
  const v = Number(n);
  if (Number.isNaN(v)) return String(n);
  return v.toLocaleString("en-NG", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (["approved", "accepted", "effective", "on_track", "published", "validated"].includes(s))
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (["critical", "overdue", "rejected", "ineffective", "expired"].includes(s))
    return "bg-red-50 text-red-800 border-red-200";
  if (["high", "returned", "under_review", "review", "in_progress"].includes(s))
    return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}
