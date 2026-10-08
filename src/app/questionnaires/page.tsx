import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, DataTable, Empty } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { createQuestionnaire } from "@/server/records";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function QuestionnairesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  let rows: { id: string; title: string; status?: string | null }[] = [];
  if (db) {
    try {
      const q = await db.select().from(s.questionnaires).limit(50);
      rows = q.map((x) => ({ id: x.id, title: x.title, status: x.status }));
    } catch { /* ignore */ }
  }
  return (
    <AppShell>
      <PageHeader title="Questionnaires" sub="Build assessment questionnaires: sections, typed questions, weights, evidence rules, requirement links." />
      <Card>
        {rows.length === 0 ? <div className="p-6"><Empty title="No questionnaires" sub="Create one below — the seed questionnaire appears after migration." /></div> :
          <DataTable columns={["Title", "Status", ""]} rows={rows.map((r) => [r.title, r.status ?? "—", <Link key={r.id} href={`/questionnaires/${r.id}`} className="font-semibold text-emerald-800">Open →</Link>])} />}
        <form action={async (f: FormData) => { "use server"; await createQuestionnaire(f); }} className="grid gap-2 border-t border-slate-100 p-5 sm:grid-cols-2">
          <input name="title" required placeholder="Questionnaire title" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="description" placeholder="Description (optional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <div className="sm:col-span-2"><button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Create questionnaire</button></div>
        </form>
      </Card>
    </AppShell>
  );
}
