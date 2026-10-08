import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, Badge, DataTable } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionUser, assertTenant } from "@/lib/auth";
import { testControl } from "@/server/actions";
import { createException, createRemediation, closeException, linkEvidence } from "@/server/records";
import { notFound } from "next/navigation";

export default async function ControlDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!db || !user?.organisationId) return notFound();
  let c;
  try {
    c = (await db.select().from(s.controls).where(eq(s.controls.id, id)).limit(1))[0];
    if (!c) return notFound();
    assertTenant(user, c.organisationId);
  } catch { return notFound(); }
  const tests = await db.select().from(s.controlTests).where(eq(s.controlTests.controlId, id)).orderBy(desc(s.controlTests.testedAt));
  const exs = await db.select().from(s.controlExceptions).where(eq(s.controlExceptions.controlId, id));
  const rems = exs.length ? await db.select().from(s.remediations) : [];
  const myRems = (eid: string) => rems.filter((r) => r.exceptionId === eid);
  const users = await db.select({ id: s.users.id, name: s.users.name }).from(s.users).limit(100);

  return (
    <AppShell>
      <PageHeader title={`${c.code} — ${c.title}`} sub={c.description ?? `Owner · Frequency ${c.frequency ?? "—"}`} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Test history ({tests.length})</div>
          <DataTable columns={["Result", "Notes", "At"]} rows={tests.map((t) => [<Badge key={t.id} status={t.result}>{t.result.replace(/_/g, " ")}</Badge>, t.notes ?? "—", t.testedAt ? new Date(t.testedAt).toLocaleString() : "—"])} />
          <form action={async (f: FormData) => { "use server"; await testControl(id, String(f.get("result")) as never, String(f.get("notes") ?? "")); }} className="flex flex-wrap gap-2 border-t border-slate-100 p-5">
            <select name="result" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="effective">effective</option><option value="partially_effective">partially effective</option>
              <option value="ineffective">ineffective</option><option value="not_tested">not tested</option>
            </select>
            <input name="notes" placeholder="Test notes…" className="min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Record test</button>
          </form>
        </Card>
        <Card>
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Exceptions & remediation ({exs.length})</div>
          <div className="space-y-3 p-5">
            {exs.map((e) => (
              <div key={e.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{e.description}</p>
                  <Badge status={e.severity ?? "medium"}>{e.severity}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">Status: {e.status}</p>
                {myRems(e.id).map((r) => <p key={r.id} className="mt-1 rounded bg-slate-50 px-2 py-1 text-xs">→ {r.action} ({r.status})</p>)}
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={async (f: FormData) => { "use server"; await createRemediation(e.id, f); }} className="flex flex-1 gap-2">
                    <input name="action" required placeholder="Remediation action…" className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs" />
                    <input name="dueDate" type="date" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                    <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold">Add</button>
                  </form>
                  {e.status !== "closed" && (
                    <form action={async () => { "use server"; await closeException(e.id, id); }}>
                      <button className="rounded-lg border border-emerald-700 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900">Close after retest</button>
                    </form>
                  )}
                </div>
              </div>
            ))}
            <form action={async (f: FormData) => { "use server"; await createException(id, f); }} className="flex flex-wrap gap-2 rounded-lg bg-slate-50 p-3">
              <input name="description" required placeholder="New exception…" className="min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <select name="severity" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="low">low</option><option value="medium">medium</option><option value="high">high</option><option value="critical">critical</option>
              </select>
              <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Raise exception</button>
            </form>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
