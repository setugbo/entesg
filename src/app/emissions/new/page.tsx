import { AppShell } from "@/components/app-shell";
import { PageHeader, Card } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { runGhgCalculation } from "@/server/actions";
import { redirect } from "next/navigation";

export default async function NewGhgRun() {
  const user = await getSessionUser();
  let factors: { id: string; code: string; fuel: string; unit: string; scope: string; factorKgco2e: unknown }[] = [];
  let sites: { id: string; name: string }[] = [];
  if (db && user?.organisationId) {
    try {
      factors = await db.select().from(s.emissionFactors);
      sites = await db.select({ id: s.sites.id, name: s.sites.name }).from(s.sites);
    } catch { /* ignore */ }
  }
  async function run(form: FormData) {
    "use server";
    const inputs = [0, 1, 2, 3, 4].flatMap((i) => {
      const factorId = form.get(`factor_${i}`);
      const activity = form.get(`activity_${i}`);
      if (!factorId || !activity) return [];
      return [{ label: String(form.get(`label_${i}`) || `Input ${i + 1}`), activityData: Number(activity), unit: String(form.get(`unit_${i}`) || ""), factorId: String(factorId), siteId: String(form.get(`site_${i}`) || "") || undefined }];
    });
    const { runId } = await runGhgCalculation({ scope: String(form.get("scope")), period: String(form.get("period")), inputs: inputs as never });
    redirect("/emissions");
  }
  return (
    <AppShell>
      <PageHeader title="New GHG calculation run" sub="Activity Data × Emission Factor = Emissions (tCO₂e). Factor source, version and methodology are frozen per run." />
      <Card>
        {!factors.length ? <p className="p-5 text-sm text-amber-800">Emission factors require a seeded database.</p> : (
          <form action={run} className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Scope</span>
                <select name="scope" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option>Scope 1</option><option>Scope 2</option><option>Scope 3</option></select></label>
              <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Period (YYYY-MM)</span>
                <input name="period" required defaultValue="2026-09" pattern="\d{4}-\d{2}" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-5">
                <input name={`label_${i}`} placeholder={`Source ${i + 1} (e.g. Diesel — Ogun)`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input name={`activity_${i}`} type="number" step="any" placeholder="Activity" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input name={`unit_${i}`} placeholder="Unit (L, kWh…)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <select name={`factor_${i}`} defaultValue="" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Factor…</option>
                  {factors.map((f) => <option key={f.id} value={f.id}>{f.code} · {f.fuel} ({String(f.factorKgco2e)} kg/U)</option>)}
                </select>
                <select name={`site_${i}`} defaultValue="" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Site…</option>{sites.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
            ))}
            <button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Run calculation</button>
          </form>
        )}
      </Card>
    </AppShell>
  );
}
