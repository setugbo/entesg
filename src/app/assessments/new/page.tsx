import { AppShell } from "@/components/app-shell";
import { PageHeader, Card } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function NewAssessment() {
  const user = await getSessionUser();
  let questionnaires: { id: string; title: string }[] = [];
  if (db && user?.organisationId) {
    try {
      questionnaires = await db.select({ id: s.questionnaires.id, title: s.questionnaires.title }).from(s.questionnaires);
    } catch { /* ignore */ }
  }
  async function create(f: FormData) {
    "use server";
    const { db: d } = await import("@/db");
    const { getSessionUser: g } = await import("@/lib/auth");
    if (!d) throw new Error("Database not configured.");
    const me = await g();
    if (!me?.organisationId) throw new Error("No organisation context.");
    const qid = String(f.get("questionnaireId"));
    const title = String(f.get("title"));
    const { assessments } = await import("@/db/schema");
    const [a] = await d.insert(assessments).values({ organisationId: me.organisationId, questionnaireId: qid, title, status: "draft", ownerId: me.id }).returning();
    redirect(`/assessments/${a.id}`);
  }
  return (
    <AppShell>
      <PageHeader title="New assessment" sub="Select a questionnaire. Applicability is evaluated per organisation." />
      <Card><form action={create} className="space-y-4 p-5">
        <label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Title</span>
          <input name="title" required defaultValue="ESG Readiness — Q4 2026" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold uppercase text-slate-500">Questionnaire</span>
          <select name="questionnaireId" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {questionnaires.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
          </select></label>
        <button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Create & open</button>
        {questionnaires.length === 0 && <p className="text-xs text-amber-700">No questionnaires in DB yet — run seed, or connect DATABASE_URL.</p>}
      </form></Card>
    </AppShell>
  );
}
