import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, Badge, DataTable } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { transitionReport } from "@/server/actions";
import { linkReportData } from "@/server/records";

export default async function ReportDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let title = "FY2026 Sustainability Report (preview)";
  let sections: { title: string; content?: string | null }[] = [
    { title: "Governance & Strategy" }, { title: "Materiality" }, { title: "Climate & GHG (IFRS S2)" },
    { title: "Environment — Energy, Water, Waste" }, { title: "Social & Workforce" }, { title: "Assurance Readiness" },
  ];
  let status = "draft";
  if (db) {
    try {
      const r = (await db.select().from(s.reports).where(eq(s.reports.id, id)).limit(1))[0];
      if (r) {
        title = r.title; status = r.status;
        const secs = await db.select().from(s.reportSections).where(eq(s.reportSections.reportId, id));
        if (secs.length) sections = secs.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      }
    } catch { /* preview */ }
  }
  const doT = (to: "review" | "approval" | "published") => async () => { "use server"; await transitionReport(id, to); };
  return (
    <AppShell>
      <PageHeader title={title} sub="Only approved data may be published. Publishing with unapproved links is blocked server-side."
        actions={<div className="flex gap-2">
          <form action={doT("review")}><button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold">To review</button></form>
          <form action={doT("approval")}><button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold">To approval</button></form>
          <form action={doT("published")}><button className="rounded-lg bg-emerald-900 px-3 py-2 text-xs font-semibold text-white">Publish</button></form>
          <a href={`/api/reports/${id}/export?format=csv`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold">CSV</a>
          <a href={`/api/reports/${id}/export?format=pdf`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold">PDF</a>
          <a href={`/api/reports/${id}/export?format=docx`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold">DOCX</a>
        </div>} />
      <Card><div className="border-b border-slate-100 px-5 py-3"><Badge status={status}>{status}</Badge></div>
        <DataTable columns={["Section", "Content"]} rows={sections.map((x) => [x.title, (x.content ?? "Pending narrative").slice(0, 120)])} />
        {db && (
          <form action={async (f: FormData) => { "use server"; await linkReportData(id, String(f.get("entityType")), String(f.get("entityId"))); }} className="flex flex-wrap gap-2 border-t border-slate-100 p-5">
            <span className="w-full text-[11px] font-bold uppercase tracking-wide text-slate-500">Link approved data (publish is blocked on unapproved links)</span>
            <select name="entityType" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="metric_value">metric value</option><option value="calculation_run">GHG run</option>
              <option value="assessment">assessment</option><option value="evidence">evidence</option>
            </select>
            <input name="entityId" required placeholder="Entity UUID (copy from its module)" className="min-w-64 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Link data</button>
          </form>
        )}</Card>
    </AppShell>
  );
}
