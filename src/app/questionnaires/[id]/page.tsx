import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, Badge, DataTable } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { createSection, createQuestion, assignQuestion } from "@/server/records";
import { notFound, redirect } from "next/navigation";

const TYPES = ["yes_no","single_choice","multiple_choice","text","long_text","number","percentage","currency","date","select","multi_select","rating","metric","evidence_required","file_upload"];

export default async function QuestionnaireDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!db) return notFound();
  const q = (await db.select().from(s.questionnaires).where(eq(s.questionnaires.id, id)).limit(1))[0];
  if (!q) return notFound();
  const sections = await db.select().from(s.questionnaireSections).where(eq(s.questionnaireSections.questionnaireId, id));
  const allQ = await db.select().from(s.questions);
  const qs = allQ.filter((x) => sections.some((sec) => sec.id === x.sectionId));
  const reqs = await db.select({ id: s.requirements.id, code: s.requirements.code }).from(s.requirements).limit(200);
  const people = await db.select({ id: s.users.id, name: s.users.name }).from(s.users).limit(200);
  const pname = new Map(people.map((p) => [p.id, p.name]));

  return (
    <AppShell>
      <PageHeader title={q.title} sub={q.description ?? ""} />
      <Card>
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Sections ({sections.length})</div>
        <div className="space-y-4 p-5">
          {sections.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((sec) => (
            <div key={sec.id} className="rounded-lg border border-slate-200">
              <p className="border-b border-slate-100 px-4 py-2 text-sm font-bold">{sec.title}</p>
              <DataTable columns={["Code", "Question", "Type", "Weight", "Evidence?", "Owner"]}
                rows={qs.filter((x) => x.sectionId === sec.id).map((x) => [x.code, x.text.slice(0, 90), x.type, String(x.weight ?? 1), x.requiredEvidence ? <Badge key={x.id} status="high">required</Badge> : "—", (x.ownerId && pname.get(x.ownerId)) || "—"])} />
              <details className="px-4 py-2">
                <summary className="cursor-pointer text-xs font-semibold text-emerald-800">Add question to this section</summary>
                <form action={async (f: FormData) => { "use server"; await createQuestion(sec.id, f); }} className="grid gap-2 py-3 sm:grid-cols-3">
                  <input name="code" required placeholder="Code (e.g. GOV-04)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <select name="type" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                  <input name="weight" type="number" step="any" defaultValue="1" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input name="text" required placeholder="Question text" className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-3" />
                  <input name="guidance" placeholder="Guidance for respondents" className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" />
                  <input name="options" placeholder="Options, comma-separated (choice types)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <select name="requirementId" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="">Linked requirement…</option>{reqs.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
                  </select>
                  <select name="ownerId" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="">Question owner…</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="requiredEvidence" value="yes" /> evidence required</label>
                  <div><button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Add question</button></div>
                </form>
              </details>
            </div>
          ))}
          <form action={async (f: FormData) => { "use server"; await createSection(id, f); }} className="flex gap-2 rounded-lg bg-slate-50 p-3">
            <input name="title" required placeholder="New section title (e.g. Strategy)" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Add section</button>
          </form>
        </div>
      </Card>
      <Card>
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Assign / reassign a question</div>
        <form action={async (f: FormData) => { "use server"; await assignQuestion(String(f.get("questionId")), f); }} className="grid gap-2 p-5 sm:grid-cols-3">
          <select name="questionId" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {qs.map((x) => <option key={x.id} value={x.id}>{x.code} — {x.text.slice(0, 60)}</option>)}
          </select>
          <select name="ownerId" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Owner…</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="flex gap-2">
            <select name="reviewerId" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Reviewer…</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Assign</button>
          </div>
        </form>
      </Card>
    </AppShell>
  );
}
