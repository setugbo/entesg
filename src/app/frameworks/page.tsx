import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, Badge, DataTable } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { DEMO } from "@/server/demo";

export default async function FrameworksPage() {
  let rows = DEMO.frameworks.map((f) => ({ code: f.code, version: f.version, reqs: f.reqs }));
  if (db) {
    try {
      const fws = await db.select().from(s.frameworks);
      const vers = await db.select().from(s.frameworkVersions);
      const reqs = await db.select().from(s.requirements);
      if (fws.length) rows = fws.map((f) => {
        const v = vers.filter((x) => x.frameworkId === f.id);
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
    </AppShell>
  );
}
