import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, DataTable, Badge } from "@/components/ui";
import { MaterialityMatrix } from "@/components/charts";
import { getSessionUser } from "@/lib/auth";
import { getModule } from "@/server/modules";
import { createRecord, escalateOverdue, clearOrgSwitch } from "@/server/records";
import { PendingMetricValues, DraftGhgRuns } from "./queues";
import { DEMO } from "@/server/demo";

type Field = { name: string; label: string; type?: string; required?: boolean; options?: string[]; placeholder?: string };

const META: Record<string, { title: string; sub: string; create?: Field[]; submitLabel?: string; extra?: { href: string; label: string }[] }> = {
  disclosures: { title: "Disclosures", sub: "Requirement → disclosure mapping. Each disclosure traces to requirements, data, evidence and report sections.",
    create: [{ name: "title", label: "Disclosure title", required: true, placeholder: "IFRS S2 Climate disclosure — Scope 1" }] },
  materiality: { title: "Materiality", sub: "Double materiality (impact × financial), scored 1–4 with rationale, evidence and sign-off.",
    create: [{ name: "topic", label: "Topic", required: true }, { name: "category", label: "Category (Environmental/Social/Governance)" }, { name: "impact", label: "Impact score 1–4", type: "number", placeholder: "3" }, { name: "financial", label: "Financial score 1–4", type: "number", placeholder: "3" }, { name: "rationale", label: "Rationale" }] },
  metrics: { title: "Metrics", sub: "Metric engine: code, category, unit, frequency, owner, methodology, period values and approvals.",
    create: [{ name: "code", label: "Code", required: true, placeholder: "ELC" }, { name: "name", label: "Name", required: true }, { name: "frequency", label: "Frequency", options: ["monthly", "quarterly", "annually"] }, { name: "source", label: "Source" }],
    extra: [{ href: "/metrics/submit", label: "Submit a value" }] },
  "data-requests": { title: "Data Requests", sub: "Request data from owners: Draft → Sent → In Progress → Submitted → Returned → Validated → Approved.",
    create: [{ name: "title", label: "Title", required: true, placeholder: "Submit electricity — Lagos Plant — Sep 2026" }, { name: "period", label: "Period (YYYY-MM)", placeholder: "2026-09" }, { name: "dueDate", label: "Due date", type: "date" }, { name: "priority", label: "Priority", options: ["low", "medium", "high", "critical"] }, { name: "description", label: "Description" }] },
  evidence: { title: "Evidence", sub: "Private evidence library with versions, reviews and links to requirements, metrics, controls and reports.",
    extra: [{ href: "/evidence/upload", label: "Upload evidence" }] },
  emissions: { title: "GHG & Emissions", sub: "Scope 1/2/3. Activity × Factor = Emissions. Every run is versioned with factor source and methodology.",
    extra: [{ href: "/emissions/new", label: "New calculation run" }] },
  energy: { title: "Energy", sub: "Electricity, fuel, natural gas and LPG activity data feeding Scope 1 & 2 calculations." },
  water: { title: "Water", sub: "Abstraction, consumption, recycling and discharge by site." },
  waste: { title: "Waste", sub: "Generated, recycled, recovered and landfill streams with manifests as evidence." },
  social: { title: "Social", sub: "Workforce, gender, training, health & safety, incidents, turnover and community." },
  governance: { title: "Governance", sub: "Board, ethics, anti-bribery, whistleblowing, data protection and cybersecurity." },
  risks: { title: "Risks", sub: "Risk → assessment → treatment → action → review. Likelihood × impact, residual after controls.",
    create: [{ name: "title", label: "Risk title", required: true }, { name: "category", label: "Category", options: ["Climate", "Environmental", "Regulatory", "Social", "Workforce", "Supply Chain", "Reputation", "Governance", "Data", "Operational"] }, { name: "likelihood", label: "Likelihood 1–5", type: "number" }, { name: "impact", label: "Impact 1–5", type: "number" }, { name: "description", label: "Description" }] },
  opportunities: { title: "Opportunities", sub: "Climate, efficiency and market opportunities linked to targets and CapEx.",
    create: [{ name: "title", label: "Opportunity", required: true }, { name: "category", label: "Category" }, { name: "description", label: "Description" }] },
  controls: { title: "Controls", sub: "Control → test → evidence → exception → remediation → retest.",
    create: [{ name: "code", label: "Code", required: true, placeholder: "CTL-ENV-04" }, { name: "title", label: "Title", required: true }, { name: "frequency", label: "Frequency", options: ["monthly", "quarterly", "per event", "annually"] }, { name: "description", label: "Description" }] },
  targets: { title: "Targets", sub: "Baselines, absolute/intensity targets, current values and progress.",
    create: [{ name: "title", label: "Target title", required: true }, { name: "kind", label: "Kind", options: ["absolute reduction", "intensity reduction", "net zero", "renewable energy", "water reduction", "waste reduction"] }, { name: "baselineYear", label: "Baseline year", type: "number" }, { name: "baselineValue", label: "Baseline value", type: "number" }, { name: "targetYear", label: "Target year", type: "number" }, { name: "targetValue", label: "Target value", type: "number" }] },
  "net-zero": { title: "Net Zero", sub: "Initiatives with annual reductions rolling up to targets and the net-zero pathway.",
    create: [{ name: "title", label: "Initiative", required: true }, { name: "reduction", label: "Annual reduction (tCO₂e)", type: "number" }, { name: "description", label: "Description" }] },
  capex: { title: "CapEx Alignment", sub: "Assets, investment, emissions impact, net-zero compatibility and alignment gaps.",
    create: [{ name: "asset", label: "Asset", required: true }, { name: "investment", label: "Investment (NGN)", type: "number" }, { name: "compatible", label: "Net-zero compatible", options: ["yes", "no"] }, { name: "gap", label: "Alignment gap" }, { name: "action", label: "Recommended action" }] },
  assurance: { title: "Assurance", sub: "Assurance readiness: lineage completeness, approvals, evidence coverage and open exceptions." },
  tasks: { title: "Tasks & Approvals", sub: "Unified queue of tasks, review/approval decisions with user, date, decision and comment.",
    create: [{ name: "title", label: "Task", required: true }, { name: "dueDate", label: "Due date", type: "date" }, { name: "description", label: "Description" }] },
  notifications: { title: "Notifications", sub: "Due dates, overdue escalations, review decisions and approvals." },
  organisations: { title: "Organisation", sub: "Organisation → business entity → site → department → users. Strict tenant isolation." },
  consultant: { title: "Consultant Workspace", sub: "Multi-client view. Consultants only see assigned organisations (server-enforced)." },
  admin: { title: "Admin & Audit", sub: "Users, roles, permissions and the immutable audit trail." },
  settings: { title: "Settings", sub: "Organisation settings: base year, currency, internal carbon price, fiscal calendar." },
  lineage: { title: "Data Lineage", sub: "Trace any approved number back to source: requirement → … → assurance." },
};

export function ModulePage(moduleKey: string) {
  return async function Page() {
    const user = await getSessionUser();
    const meta = META[moduleKey] ?? { title: moduleKey, sub: "" };
    const m = await getModule(moduleKey, user?.organisationId ?? null);
    const create = async (form: FormData) => { "use server"; await createRecord(moduleKey, form); };
    return (
      <AppShell>
        <PageHeader title={meta.title} sub={meta.sub}
          actions={<>
            {moduleKey === "data-requests" && (
              <form action={async () => { "use server"; await escalateOverdue(); }}>
                <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">Run overdue escalation</button>
              </form>
            )}
            {moduleKey === "consultant" && user && (
              <form action={async () => { "use server"; await clearOrgSwitch(); }}>
                <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">Reset to home org</button>
              </form>
            )}
            {(meta.extra ?? []).map((e) => (
              <a key={e.href} href={e.href} className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">{e.label}</a>
            ))}
          </>} />
        {meta.create && (
          <Card>
            <form action={create} className="grid gap-3 p-5 sm:grid-cols-2">
              {meta.create.map((f) => (
                <label key={f.name} className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">{f.label}</span>
                  {f.options ? (
                    <select name={f.name} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input name={f.name} type={f.type ?? "text"} required={f.required} placeholder={f.placeholder} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  )}
                </label>
              ))}
              <div className="flex items-end sm:col-span-2">
                <button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Create {meta.title.toLowerCase().replace(/s$/, "")}</button>
                {m.demo && <span className="ml-3 text-xs text-slate-400">Saving requires DATABASE_URL.</span>}
              </div>
            </form>
          </Card>
        )}
        <div className={meta.create ? "mt-4" : ""}>
          {moduleKey === "materiality" && (
            <Card><div className="mb-4 p-4"><MaterialityMatrix topics={DEMO.materiality} /></div></Card>
          )}
          {moduleKey === "metrics" && <div className="mb-4"><PendingMetricValues /></div>}
          {moduleKey === "emissions" && <div className="mb-4"><DraftGhgRuns /></div>}
          {moduleKey === "lineage" ? (
            <Card>
              <div className="p-5">
                <ol className="relative space-y-4 border-l-2 border-emerald-200 pl-5">
                  {DEMO.lineage.map((l) => (
                    <li key={l.step} className="relative">
                      <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-emerald-600" />
                      <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">{l.step}</p>
                      <p className="text-sm text-slate-700">{l.detail}</p>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-xs text-slate-500">Every disclosure answers: where did this number come from, who provided it, what evidence supports it, which methodology, who reviewed/approved it, and which report uses it.</p>
              </div>
            </Card>
          ) : moduleKey === "notifications" ? (
            <NotificationsList />
          ) : (
            <Card><DataTable
              columns={m.linkPrefix && !m.demo ? [...m.columns, ""] : m.columns}
              rows={m.rows.map((r) => (m.linkPrefix && !m.demo
                ? [...r.cells, <a key={r.id ?? r.cells[0]} href={`${m.linkPrefix}/${r.id}`} className="font-semibold text-emerald-800">Open →</a>]
                : [...r.cells]))}
            /></Card>
          )}
          {m.demo && moduleKey !== "lineage" && (
            <p className="mt-2 text-xs text-slate-400">Preview data shown. Connect a database and seed to work with live {meta.title.toLowerCase()}.</p>
          )}
        </div>
      </AppShell>
    );
  };
}

async function NotificationsList() {
  const { db } = await import("@/db");
  const { notifications } = await import("@/db/schema");
  const { eq, desc } = await import("drizzle-orm");
  const user = await getSessionUser();
  let rows: { title: string; body?: string | null; createdAt?: Date | null }[] = [];
  if (db && user?.organisationId) {
    try {
      rows = await db.select().from(notifications)
        .where(eq(notifications.organisationId, user.organisationId))
        .orderBy(desc(notifications.createdAt)).limit(50);
    } catch { /* ignore */ }
  }
  if (!rows.length) rows = [
    { title: "Diesel request overdue — Ogun fleet", body: "Escalated to Operations" },
    { title: "Evidence accepted — PHCN bill Aug", body: "v2 approved by reviewer" },
    { title: "Assessment returned by reviewer", body: "Evidence linkage missing on 2 answers" },
  ];
  return (
    <Card>
      <div className="divide-y divide-slate-100">
        {rows.map((n, i) => (
          <div key={i} className="px-5 py-3">
            <p className="text-sm font-medium text-slate-800">{n.title}</p>
            {n.body && <p className="text-xs text-slate-500">{n.body}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function StatusBadge({ value }: { value: string }) {
  return <Badge status={value}>{value.replace(/_/g, " ")}</Badge>;
}
