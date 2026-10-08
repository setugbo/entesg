import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, Badge, DataTable, Empty } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { createReport } from "@/server/actions";

export default async function ReportsPage() {
  const user = await getSessionUser();
  let rows: { id: string; title: string; period?: string | null; status: string }[] = [];
  if (db && user?.organisationId) {
    try {
      const r = await db.select().from(s.reports).where(eq(s.reports.organisationId, user.organisationId)).orderBy(desc(s.reports.createdAt));
      rows = r.map((x) => ({ id: x.id, title: x.title, period: x.period, status: x.status }));
    } catch { /* demo */ }
  }
  if (!rows.length && !db) rows = [{ id: "demo", title: "FY2026 Sustainability Report (IFRS S1/S2)", period: "2026", status: "draft" }];
  return (
    <AppShell>
      <PageHeader title="Reports" sub="Assembled only from approved data. Draft → Review → Approval → Published. Publishing is blocked when unapproved data is linked."
        actions={<form action={async (f: FormData) => { "use server"; await createReport({ title: String(f.get("title") ?? "New ESG Report"), period: String(f.get("period") ?? "2026") }); }} className="flex gap-2">
          <input name="title" placeholder="Report title" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">New report</button>
        </form>} />
      <Card>
        {rows.length === 0 ? <div className="p-6"><Empty title="No reports" sub="Create your first report — sections assemble from approved disclosures." /></div> :
        <DataTable columns={["Title", "Period", "Status", ""]} rows={rows.map((r) => [r.title, r.period ?? "—", <Badge key={r.id} status={r.status}>{r.status}</Badge>, <a key={r.id + "o"} href={`/reports/${r.id}`} className="font-semibold text-emerald-800">Open →</a>])} />}
      </Card>
    </AppShell>
  );
}
