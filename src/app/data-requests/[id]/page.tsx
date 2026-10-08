import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, Badge, DataTable } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, assertTenant } from "@/lib/auth";
import { sendRequest, submitRequest, validateRequest, approveRequest, returnRequest } from "@/server/actions";
import { postComment } from "@/server/records";
import { notFound } from "next/navigation";

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!db || !user?.organisationId) return notFound();
  let r;
  try {
    r = (await db.select().from(s.dataRequests).where(eq(s.dataRequests.id, id)).limit(1))[0];
    if (!r) return notFound();
    assertTenant(user, r.organisationId);
  } catch { return notFound(); }
  const items = await db.select().from(s.dataRequestItems).where(eq(s.dataRequestItems.requestId, id));
  const subs = await db.select().from(s.dataSubmissions).where(eq(s.dataSubmissions.requestId, id));
  const cmts = await db.select().from(s.comments).where(eq(s.comments.entityId, id as never)).limit(20);
  const btn = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50";
  const go = (fn: (id: string) => Promise<unknown>) => async () => { "use server"; await fn(id); };
  return (
    <AppShell>
      <PageHeader title={r.title} sub={`Period ${r.period ?? "—"} · due ${r.dueDate ?? "—"} · priority ${r.priority}`}
        actions={<div className="flex flex-wrap gap-2">
          <form action={go(sendRequest)}><button className={btn}>Send</button></form>
          <form action={go(submitRequest)}><button className={btn}>Submit</button></form>
          <form action={go(validateRequest)}><button className={btn}>Validate</button></form>
          <form action={go(approveRequest)}><button className="rounded-lg bg-emerald-900 px-3 py-2 text-xs font-semibold text-white">Approve</button></form>
          <form action={go(returnRequest)}><button className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700">Return</button></form>
        </div>} />
      <div className="mb-4"><Badge status={r.status}>{r.status.replace(/_/g, " ")}</Badge></div>
      {r.description && <Card><p className="p-5 text-sm text-slate-700">{r.description}</p></Card>}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Requested items ({items.length})</div>
          <DataTable columns={["Item", "Required"]} rows={items.map((i) => [i.label, i.required ? "Yes" : "No"])} />
        </Card>
        <Card>
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Submissions ({subs.length})</div>
          <DataTable columns={["Comment", "At"]} rows={subs.map((x) => [x.comment ?? "—", x.createdAt ? new Date(x.createdAt).toLocaleString() : "—"])} />
        </Card>
      </div>
      <Card>
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Comments</div>
        <div className="space-y-2 p-5">
          {cmts.map((c) => <p key={c.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">{c.body}</p>)}
          <form action={async (f: FormData) => { "use server"; await postComment("data_request", id, f); }} className="flex gap-2">
            <input name="body" required placeholder="Add a comment…" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Post</button>
          </form>
        </div>
      </Card>
    </AppShell>
  );
}
