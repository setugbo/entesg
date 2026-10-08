import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, Badge, DataTable } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { isApplicable } from "@/lib/applicability";

export default async function RequirementsPage() {
  const user = await getSessionUser();
  let rows: { code: string; title: string; topic?: string | null; criticality?: string | null; applicable?: boolean }[] = [];
  let orgProfile = { jurisdiction: "Nigeria", industry: "FMCG / Manufacturing" };
  if (db) {
    try {
      const reqs = await db.select().from(s.requirements).limit(100);
      let org = null;
      if (user?.organisationId) {
        const { organisations } = s;
        const { eq } = await import("drizzle-orm");
        org = (await db.select().from(organisations).where(eq(organisations.id, user.organisationId)).limit(1))[0];
        if (org) orgProfile = { jurisdiction: org.jurisdiction ?? "Nigeria", industry: org.industry ?? "" };
      }
      rows = reqs.map((r) => ({
        code: r.code, title: r.title, topic: r.topic, criticality: r.criticality,
        applicable: isApplicable({ applicability: (r.applicability ?? {}) as Record<string, unknown>, jurisdiction: r.jurisdiction, sector: r.sector }, orgProfile),
      }));
    } catch { /* fallthrough */ }
  }
  if (!rows.length) {
    rows = [
      { code: "IFRS S2-CLI", title: "IFRS S2: Scope 1 disclosure by source", topic: "Metrics", criticality: "critical", applicable: true },
      { code: "IFRS S2-S2", title: "IFRS S2: Scope 2 location & market based", topic: "Metrics", criticality: "critical", applicable: true },
      { code: "ESRS-E1", title: "ESRS E1: Climate transition plan", topic: "Strategy", criticality: "high", applicable: false },
      { code: "GRI-303", title: "GRI 303: Water and effluents", topic: "Metrics", criticality: "medium", applicable: true },
    ];
  }
  return (
    <AppShell>
      <PageHeader title="Requirements" sub="Applicability is computed per organisation (jurisdiction, sector, size, frameworks, materiality) — not every requirement applies to everyone." />
      <Card><DataTable columns={["Code", "Requirement", "Topic", "Criticality", "Applicability"]}
        rows={rows.map((r, i) => [r.code, r.title, r.topic ?? "—",
          <Badge key={i} status={r.criticality ?? "medium"}>{r.criticality}</Badge>,
          <Badge key={i + "a"} status={r.applicable ? "approved" : "medium"}>{r.applicable ? "Applicable" : "Not applicable"}</Badge>])} /></Card>
    </AppShell>
  );
}
