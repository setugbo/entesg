import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, Badge, DataTable } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getSessionUser, assertTenant } from "@/lib/auth";
import { linkDisclosureRequirement } from "@/server/records";
import { notFound } from "next/navigation";

export default async function DisclosureDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!db || !user?.organisationId) return notFound();
  let d;
  try {
    d = (await db.select().from(s.disclosures).where(eq(s.disclosures.id, id)).limit(1))[0];
    if (!d) return notFound();
    if (d.organisationId) assertTenant(user, d.organisationId);
  } catch { return notFound(); }
  const links = await db.select().from(s.disclosureRequirements).where(eq(s.disclosureRequirements.disclosureId, id));
  const reqs = links.length
    ? await db.select().from(s.requirements).where(inArray(s.requirements.id, links.map((l) => l.requirementId)))
    : [];
  const allReqs = await db.select({ id: s.requirements.id, code: s.requirements.code, title: s.requirements.title }).from(s.requirements).limit(200);

  return (
    <AppShell>
      <PageHeader title={d.title} sub="Disclosure with mapped requirements feeding report sections." />
      <div className="mb-4"><Badge status={d.status ?? "draft"}>{(d.status ?? "draft").replace(/_/g, " ")}</Badge></div>
      <Card>
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Mapped requirements ({reqs.length})</div>
        <DataTable columns={["Code", "Requirement"]} rows={reqs.map((r) => [r.code, r.title])} />
        <form action={async (f: FormData) => { "use server"; await linkDisclosureRequirement(id, f); }} className="flex gap-2 border-t border-slate-100 p-5">
          <select name="requirementId" required className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {allReqs.map((r) => <option key={r.id} value={r.id}>{r.code} — {r.title.slice(0, 80)}</option>)}
          </select>
          <button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Map requirement</button>
        </form>
      </Card>
    </AppShell>
  );
}
