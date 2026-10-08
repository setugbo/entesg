import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, Badge } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, assertTenant } from "@/lib/auth";
import { updateTask, postComment } from "@/server/records";
import { notFound } from "next/navigation";

export default async function TaskDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!db || !user?.organisationId) return notFound();
  let t;
  try {
    t = (await db.select().from(s.tasks).where(eq(s.tasks.id, id)).limit(1))[0];
    if (!t) return notFound();
    assertTenant(user, t.organisationId);
  } catch { return notFound(); }
  const users = await db.select({ id: s.users.id, name: s.users.name }).from(s.users).limit(100);
  const cmts = await db.select().from(s.comments).where(eq(s.comments.entityId, id as never)).limit(20);

  return (
    <AppShell>
      <PageHeader title={t.title} sub={`Due ${t.dueDate ?? "—"}${t.entityType ? ` · linked ${t.entityType}` : ""}`} />
      <div className="mb-4"><Badge status={t.status}>{t.status.replace(/_/g, " ")}</Badge></div>
      {t.description && <Card><p className="p-5 text-sm text-slate-700">{t.description}</p></Card>}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Status & assignment</div>
          <form action={async (f: FormData) => { "use server"; await updateTask(id, f); }} className="grid gap-2 p-5 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Status</span>
              <select name="status" defaultValue={t.status} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="open">open</option><option value="in_progress">in progress</option><option value="blocked">blocked</option><option value="done">done</option><option value="cancelled">cancelled</option>
              </select></label>
            <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Assignee</span>
              <select name="assigneeId" defaultValue={t.assigneeId ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select></label>
            <div className="sm:col-span-2"><button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Update task</button></div>
          </form>
        </Card>
        <Card>
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Comments</div>
          <div className="space-y-2 p-5">
            {cmts.map((c) => <p key={c.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">{c.body}</p>)}
            <form action={async (f: FormData) => { "use server"; await postComment("task", id, f); }} className="flex gap-2">
              <input name="body" required placeholder="Add a comment…" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Post</button>
            </form>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
