import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, Badge, DataTable } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { transitionReport } from "@/server/actions";

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
          <a href={`/api/reports/${id}/export`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold">Export CSV</a>
        </div>} />
      <Card><div className="border-b border-slate-100 px-5 py-3"><Badge status={status}>{status}</Badge></div>
        <DataTable columns={["Section", "Content"]} rows={sections.map((x) => [x.title, (x.content ?? "Pending narrative").slice(0, 120)])} /></Card>
    </AppShell>
  );
}
