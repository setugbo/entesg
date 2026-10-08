import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, Badge, DataTable, Empty } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { DEMO } from "@/server/demo";
import Link from "next/link";

export default async function AssessmentsPage() {
  const user = await getSessionUser();
  const live = Boolean(db && user?.organisationId);
  let rows: { id: string; title: string; status: string; score?: string | null; readinessBand?: string | null }[] = live ? [] : DEMO.assessments;
  if (db && user?.organisationId) {
    try {
      const r = await db.select().from(s.assessments).where(eq(s.assessments.organisationId, user.organisationId)).orderBy(desc(s.assessments.updatedAt));
      if (r.length) rows = r.map((a) => ({ id: a.id, title: a.title, status: a.status, score: a.score as string | null, readinessBand: a.readinessBand }));
    } catch { /* demo */ }
  }
  return (
    <AppShell>
      <PageHeader title="Assessments" sub="Draft → In Progress → Submitted → Under Review → Returned → Approved. Scores are readiness signals, not compliance conclusions."
        actions={<Link href="/assessments/new" className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">New assessment</Link>} />
      <Card>
        {rows.length === 0 ? <div className="p-6"><Empty title="No assessments" sub="Start your first readiness assessment." /></div> :
        <DataTable columns={["Title", "Status", "Score", "Band", ""]} rows={rows.map((a) => [
          a.title, <Badge key={a.id} status={a.status}>{a.status.replace(/_/g, " ")}</Badge>,
          a.score ? `${a.score}%` : "—", a.readinessBand ?? "—",
          <Link key={a.id + "o"} href={`/assessments/${a.id}`} className="font-semibold text-emerald-800">Open →</Link>,
        ])} />}
      </Card>
    </AppShell>
  );
}
