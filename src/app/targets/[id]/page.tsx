import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, Badge, DataTable } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, assertTenant } from "@/lib/auth";
import { updateTargetProgress } from "@/server/records";
import { progressOf } from "@/server/modules";
import { notFound } from "next/navigation";

export default async function TargetDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!db || !user?.organisationId) return notFound();
  let t;
  try {
    t = (await db.select().from(s.targets).where(eq(s.targets.id, id)).limit(1))[0];
    if (!t) return notFound();
    assertTenant(user, t.organisationId);
  } catch { return notFound(); }
  const inits = await db.select().from(s.initiatives).where(eq(s.initiatives.organisationId, t.organisationId!));
  const mine = inits.filter((i) => i.targetId === id);
  const pct = progressOf(t.baselineValue, t.currentValue, t.targetValue);

  return (
    <AppShell>
      <PageHeader title={t.title} sub={`${t.kind ?? "—"} · baseline ${t.baselineYear ?? "—"} (${t.baselineValue ?? "—"}) → target ${t.targetYear ?? "—"} (${t.targetValue ?? "—"})`} />
      <div className="mb-4"><Badge status={t.status ?? "on_track"}>{(t.status ?? "on_track").replace(/_/g, " ")}</Badge></div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Progress — {pct}</div>
          <div className="p-5">
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-700" style={{ width: pct === "—" ? "0%" : pct }} />
            </div>
            <p className="mt-2 text-sm text-slate-600">Current value: <strong>{t.currentValue != null ? String(t.currentValue) : "not yet recorded"}</strong></p>
            <form action={async (f: FormData) => { "use server"; await updateTargetProgress(id, f); }} className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
              <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Current value</span>
                <input name="currentValue" type="number" step="any" required defaultValue={t.currentValue != null ? String(t.currentValue) : ""} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
              <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Status</span>
                <select name="status" defaultValue={t.status ?? "on_track"} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="on_track">on track</option><option value="at_risk">at risk</option><option value="off_track">off track</option><option value="achieved">achieved</option>
                </select></label>
              <div className="flex items-end"><button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Record progress</button></div>
            </form>
          </div>
        </Card>
        <Card>
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Linked initiatives ({mine.length})</div>
          <DataTable columns={["Initiative", "Annual reduction", "Status"]} rows={mine.map((i) => [i.title, i.annualReductionTco2e != null ? `${i.annualReductionTco2e} tCO₂e` : "—", i.status ?? "—"])} />
        </Card>
      </div>
    </AppShell>
  );
}
