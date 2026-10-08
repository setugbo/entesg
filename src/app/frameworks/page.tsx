import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, Badge, DataTable } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { createFramework, createFrameworkVersion, createRequirement } from "@/server/records";
import { DEMO } from "@/server/demo";

export default async function FrameworksPage() {
  const user = await getSessionUser();
  const canManage = !!user && (user.roleKeys.includes("SUPER_ADMIN") || hasPermission(user.roleKeys, "requirement.manage"));
  let rows = DEMO.frameworks.map((f) => ({ code: f.code, version: f.version, reqs: f.reqs }));
  let fws: { id: string; code: string }[] = [];
  let vers: { id: string; frameworkId: string; version: string }[] = [];
  if (db) {
    try {
      const allF = await db.select().from(s.frameworks);
      const allV = await db.select().from(s.frameworkVersions);
      const reqs = await db.select().from(s.requirements);
      fws = allF.map((f) => ({ id: f.id, code: f.code }));
      vers = allV.map((v) => ({ id: v.id, frameworkId: v.frameworkId, version: v.version }));
      if (allF.length) rows = allF.map((f) => {
        const v = allV.filter((x) => x.frameworkId === f.id);
        const n = reqs.filter((r) => v.some((x) => x.id === r.frameworkVersionId)).length;
        return { code: f.code, version: v.map((x) => x.version).join(", ") || "—", reqs: n };
      });
    } catch { /* demo */ }
  }
  return (
    <AppShell>
      <PageHeader title="Frameworks" sub="Configurable regulatory engine. Records carry source, version, jurisdiction and SME-validation status — never hard-coded into logic." />
      <Card><DataTable columns={["Framework", "Version(s)", "Requirements", "Review"]}
        rows={rows.map((r) => [r.code, r.version, String(r.reqs), <Badge key={r.code} status="medium">Requires SME validation</Badge>])} /></Card>
      <p className="mt-3 text-xs text-slate-500">Supported architecture: IFRS S1 · IFRS S2 · GHG Protocol · GRI · ESRS · SASB · Nigerian & sector requirements · investor questionnaires.</p>
      {canManage && db && (
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <Card>
            <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Add framework</div>
            <form action={async (f: FormData) => { "use server"; await createFramework(f); }} className="space-y-2 p-5">
              <input name="code" required placeholder="Code (e.g. NG-SEC)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="name" required placeholder="Name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="publisher" placeholder="Publisher" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Add</button>
            </form>
          </Card>
          <Card>
            <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Add version</div>
            <form action={async (f: FormData) => { "use server"; await createFrameworkVersion(String(f.get("frameworkId")), f); }} className="space-y-2 p-5">
              <select name="frameworkId" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {fws.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}
              </select>
              <input name="version" required placeholder="Version (e.g. 2025)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="jurisdiction" placeholder="Jurisdiction" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Add</button>
            </form>
          </Card>
          <Card>
            <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Add requirement</div>
            <form action={async (f: FormData) => { "use server"; await createRequirement(f); }} className="space-y-2 p-5">
              <select name="frameworkVersionId" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {vers.map((v) => <option key={v.id} value={v.id}>{fws.find((f) => f.id === v.frameworkId)?.code} · {v.version}</option>)}
              </select>
              <input name="code" required placeholder="Code" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="title" required placeholder="Title" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input name="topic" placeholder="Topic" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <select name="criticality" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="low">low</option><option value="medium">medium</option><option value="high">high</option><option value="critical">critical</option>
                </select>
              </div>
              <input name="sourceOrg" placeholder="Source organisation" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Add (flagged for SME validation)</button>
            </form>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
