import { AppShell } from "@/components/app-shell";
import { PageHeader, Card } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { submitMetricValueForm } from "@/server/records";

export default async function SubmitMetricPage() {
  const user = await getSessionUser();
  let metrics: { id: string; code: string; name: string }[] = [];
  let sites: { id: string; name: string }[] = [];
  if (db && user?.organisationId) {
    try {
      const all = await db.select().from(s.metrics);
      metrics = all.filter((m) => !m.organisationId || m.organisationId === user.organisationId).map((m) => ({ id: m.id, code: m.code, name: m.name }));
      sites = (await db.select({ id: s.sites.id, name: s.sites.name }).from(s.sites)).filter(Boolean) as never;
    } catch { /* ignore */ }
  }
  return (
    <AppShell>
      <PageHeader title="Submit metric value" sub="Submissions enter validation automatically (range & completeness rules) before review and approval." />
      <Card>
        {!metrics.length ? <p className="p-5 text-sm text-amber-800">Metrics require a seeded database.</p> : (
          <form action={submitMetricValueForm} className="grid gap-3 p-5 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Metric</span>
              <select name="metricId" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {metrics.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
              </select></label>
            <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Site</span>
              <select name="siteId" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Group-wide</option>{sites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select></label>
            <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Period (YYYY-MM or YYYY-Q1..Q4)</span>
              <input name="period" required defaultValue="2026-09" pattern="\d{4}-(Q[1-4]|\d{2})" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Value</span>
              <input name="value" type="number" step="any" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <div className="sm:col-span-2"><button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Submit for validation</button></div>
          </form>
        )}
      </Card>
    </AppShell>
  );
}
