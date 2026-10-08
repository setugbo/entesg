import { Card, DataTable } from "./ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { validateMetricValue, approveMetricValue, rejectMetricValue } from "@/server/records";
import { approveGhgRun } from "@/server/actions";

/** Values awaiting validation/approval (metric.submit → validated → approved). */
export async function PendingMetricValues() {
  const me = await getSessionUser();
  if (!db || !me?.organisationId) return null;
  let rows: typeof s.metricValues.$inferSelect[] = [];
  let names = new Map<string, string>();
  try {
    rows = await db.select().from(s.metricValues)
      .where(eq(s.metricValues.organisationId, me.organisationId))
      .orderBy(desc(s.metricValues.createdAt)).limit(20);
    rows = rows.filter((r) => ["submitted", "validated"].includes(r.status));
    if (rows.length) {
      const ms = await db.select().from(s.metrics);
      names = new Map(ms.map((m) => [m.id, `${m.code} — ${m.name}`]));
    }
  } catch { return null; }
  if (!rows.length) return null;
  const canApprove = me.roleKeys.includes("SUPER_ADMIN") || me.roleKeys.some((r) => ["ORGANISATION_ADMIN", "APPROVER", "ESG_MANAGER"].includes(r));
  return (
    <Card>
      <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Validation queue ({rows.length})</div>
      <DataTable columns={["Metric", "Period", "Value", "Status", ...(canApprove ? [""] : [])]}
        rows={rows.map((r) => [
          names.get(r.metricId) ?? r.metricId.slice(0, 8), r.period, String(r.value), r.status.replace(/_/g, " "),
          ...(canApprove ? [(
            <span key={r.id} className="flex gap-1">
              <form action={async () => { "use server"; await validateMetricValue(r.id); }}><button className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold">Validate</button></form>
              <form action={async () => { "use server"; await approveMetricValue(r.id); }}><button className="rounded bg-emerald-900 px-2 py-1 text-[11px] font-semibold text-white">Approve</button></form>
              <form action={async () => { "use server"; await rejectMetricValue(r.id); }}><button className="rounded border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700">Reject</button></form>
            </span>
          )] : []),
        ])} />
    </Card>
  );
}

/** Draft GHG runs awaiting approval. */
export async function DraftGhgRuns() {
  const me = await getSessionUser();
  if (!db || !me?.organisationId) return null;
  let rows: typeof s.calculationRuns.$inferSelect[] = [];
  try {
    const all = await db.select().from(s.calculationRuns)
      .where(eq(s.calculationRuns.organisationId, me.organisationId))
      .orderBy(desc(s.calculationRuns.createdAt)).limit(10);
    rows = all.filter((r) => r.status === "draft" || r.status === "review");
  } catch { return null; }
  if (!rows.length) return null;
  const canApprove = me.roleKeys.includes("SUPER_ADMIN") || me.roleKeys.some((r) => ["ORGANISATION_ADMIN", "APPROVER"].includes(r));
  return (
    <Card>
      <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Runs awaiting approval ({rows.length})</div>
      <DataTable columns={["Period", "Scope", "Total tCO₂e", "Status", ...(canApprove ? [""] : [])]}
        rows={rows.map((r) => [r.period, r.scope, String(r.totalTco2e ?? "—"), r.status,
          ...(canApprove ? [(
            <form key={r.id} action={async () => { "use server"; await approveGhgRun(r.id); }}>
              <button className="rounded bg-emerald-900 px-2 py-1 text-[11px] font-semibold text-white">Approve run</button>
            </form>
          )] : [])])} />
    </Card>
  );
}
