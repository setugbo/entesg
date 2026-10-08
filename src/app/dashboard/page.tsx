import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, CardHeader, Badge, DataTable } from "@/components/ui";
import { TrendChart, Bars } from "@/components/charts";
import { MyAssignedQuestions } from "@/components/queues";
import { getSessionUser } from "@/lib/auth";
import { getOverview } from "@/server/data";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await getSessionUser();
  const d = await getOverview(user?.organisationId ?? null);
  const kpis = (d as { kpis?: { readiness: number; criticalGaps: number; ghg2026: number; evidenceCoverage: number; controlCoverage: number; openRequests: number } | null }).kpis
    ?? { readiness: 68, criticalGaps: 3, ghg2026: 12480, evidenceCoverage: 74, controlCoverage: 61, openRequests: 14 };
  const overview = d as { hasCriticalGap?: boolean; demo?: boolean };
  const gap = overview.hasCriticalGap === true;
  const cards: [string, string, string][] = [
    ["ESG Readiness", `${kpis.readiness}%`, gap ? "CRITICAL GAP — overrides aggregate" : "No critical gaps"],
    ["GHG 2026 (YTD)", `${Number(kpis.ghg2026).toLocaleString()} tCO₂e`, "Scope 1+2+3, versioned runs"],
    ["Evidence coverage", `${kpis.evidenceCoverage}%`, "Accepted / total linked"],
    ["Control coverage", `${kpis.controlCoverage}%`, "Tested effective / total"],
    ["Open data requests", String(kpis.openRequests ?? 14), "Includes overdue — escalate"],
    ["Assurance readiness", "Early", "File + lineage + approvals"],
  ];
  const assessments = (d as { assessments?: { id: string; title: string; status: string }[] }).assessments ?? [];
  const requests = (d as { requests?: { id: string; title: string; status: string }[] }).requests ?? [];
  const risks = (d as { risks?: { id: string; title: string; category?: string }[] }).risks ?? [];
  const targets = (d as { targets?: { id: string; title: string }[] }).targets ?? [];
  const ghgTrend = (d as { ghgTrend?: { label: string; value: number }[] }).ghgTrend ?? [];
  const scopeSplit = (d as { scopeSplit?: { label: string; value: number }[] }).scopeSplit ?? [];
  const readiness = (d as { readiness?: { dimension: string; pct: number }[] }).readiness ?? [];
  const roleKeys = user?.roleKeys ?? [];
  const isOwner = roleKeys.some((r) => ["DATA_OWNER", "CONTRIBUTOR"].includes(r));
  const isConsultant = roleKeys.includes("CONSULTANT") || roleKeys.includes("SUPER_ADMIN");
  const isExec = roleKeys.includes("EXECUTIVE") || roleKeys.includes("APPROVER") || roleKeys.includes("REVIEWER");

  return (
    <AppShell>
      <PageHeader title={`Welcome${user ? `, ${user.name.split(" ")[0]}` : ""} — Executive ESG overview`}
        sub="Readiness is a management signal, not a legal compliance conclusion. Critical gaps override aggregates."
        actions={<><Link href="/assessments" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">Assessments</Link><Link href="/reports" className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Reporting readiness</Link></>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([t, v, s]) => (
          <Card key={t}><div className="p-5"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t}</p><p className="mt-1 text-2xl font-bold tracking-tight">{v}</p><p className="mt-1 text-xs text-slate-500">{s}</p></div></Card>
        ))}
      </div>
      {(isOwner || isConsultant || isExec) && (
        <Card>
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">
            {isOwner ? "My queue — data owner" : isConsultant ? "Consultant — start here" : "Review & approval queue"}
          </div>
          <div className="flex flex-wrap gap-2 p-5 text-sm">
            {isOwner && <><Link href="/data-requests" className="rounded-lg bg-emerald-900 px-4 py-2 font-semibold text-white">Assigned requests</Link><Link href="/metrics/submit" className="rounded-lg border border-slate-300 px-4 py-2 font-semibold">Submit a value</Link><Link href="/evidence/upload" className="rounded-lg border border-slate-300 px-4 py-2 font-semibold">Upload evidence</Link></>}
            {isConsultant && <><Link href="/consultant" className="rounded-lg bg-emerald-900 px-4 py-2 font-semibold text-white">Switch client</Link><Link href="/assessments" className="rounded-lg border border-slate-300 px-4 py-2 font-semibold">Client assessments</Link><Link href="/reports" className="rounded-lg border border-slate-300 px-4 py-2 font-semibold">Client reports</Link></>}
            {isExec && !isOwner && !isConsultant && <><Link href="/tasks" className="rounded-lg bg-emerald-900 px-4 py-2 font-semibold text-white">Pending approvals</Link><Link href="/assurance" className="rounded-lg border border-slate-300 px-4 py-2 font-semibold">Assurance readiness</Link><Link href="/reports" className="rounded-lg border border-slate-300 px-4 py-2 font-semibold">Published reports</Link></>}
          </div>
        </Card>
      )}
      {isOwner && <div className="mt-4"><MyAssignedQuestions /></div>}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card><CardHeader title="GHG trend (tCO₂e)" sub="Versioned calculation runs" /><div className="p-4"><TrendChart data={ghgTrend} /></div></Card>
        <Card><CardHeader title="Emissions by scope" sub="Latest approved runs" /><div className="p-4"><Bars data={scopeSplit} /></div></Card>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Readiness by dimension" sub="Critical gaps flagged" action={<Link href="/assessments" className="text-xs font-semibold text-emerald-800">Open →</Link>} />
          <div className="space-y-2.5 p-5">
            {readiness.map((r) => (
              <div key={r.dimension}>
                <div className="mb-1 flex justify-between text-xs"><span className="font-semibold text-slate-700">{r.dimension}</span><span className="text-slate-500">{r.pct}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${r.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Assessments" sub="Draft → … → Approved" action={<Link href="/assessments" className="text-xs font-semibold text-emerald-800">Open →</Link>} />
          <DataTable columns={["Title", "Status"]} rows={assessments.slice(0, 5).map((a) => [a.title, <Badge key={a.id} status={a.status}>{a.status.replace(/_/g, " ")}</Badge>])} />
        </Card>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card><CardHeader title="Data requests" sub="Due / overdue queue" action={<Link href="/data-requests" className="text-xs font-semibold text-emerald-800">Open →</Link>} />
          <DataTable columns={["Request", "Status"]} rows={requests.slice(0, 5).map((r) => [r.title, <Badge key={r.id} status={r.status}>{String(r.status).replace(/_/g, " ")}</Badge>])} /></Card>
        <Card><CardHeader title="Top ESG risks" sub="By residual risk" action={<Link href="/risks" className="text-xs font-semibold text-emerald-800">Open →</Link>} />
          <DataTable columns={["Risk", "Category"]} rows={risks.slice(0, 5).map((r) => [r.title, r.category ?? "—"])} /></Card>
        <Card><CardHeader title="Targets" sub="Net-zero trajectory" action={<Link href="/targets" className="text-xs font-semibold text-emerald-800">Open →</Link>} />
          <DataTable columns={["Target"]} rows={targets.slice(0, 5).map((t) => [t.title])} /></Card>
      </div>
    </AppShell>
  );
}
