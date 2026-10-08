import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, Badge, DataTable } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, assertTenant } from "@/lib/auth";
import { reviewEvidence } from "@/server/actions";
import { linkEvidence, postComment } from "@/server/records";
import { signedDownloadUrl } from "@/lib/storage";
import { notFound } from "next/navigation";

export default async function EvidenceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!db || !user?.organisationId) return notFound();
  let e;
  try {
    e = (await db.select().from(s.evidence).where(eq(s.evidence.id, id)).limit(1))[0];
    if (!e) return notFound();
    assertTenant(user, e.organisationId);
  } catch { return notFound(); }
  const versions = await db.select().from(s.evidenceVersions).where(eq(s.evidenceVersions.evidenceId, id));
  const links = await db.select().from(s.evidenceLinks).where(eq(s.evidenceLinks.evidenceId, id));
  const reviews = await db.select().from(s.evidenceReviews).where(eq(s.evidenceReviews.evidenceId, id));
  const decide = (d: "approved" | "rejected" | "returned") => async (f: FormData) => { "use server"; await reviewEvidence(id, d, String(f.get("comment") ?? "")); };
  return (
    <AppShell>
      <PageHeader title={e.name} sub={`v${e.version} · ${e.mimeType ?? e.type} · ${e.sizeBytes ? `${(e.sizeBytes / 1024).toFixed(1)} KB` : ""} · period ${e.period ?? "—"}`}
        actions={<a href={`/api/evidence/${e.id}/download`} className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Download (private)</a>} />
      <div className="mb-4 flex gap-2"><Badge status={e.status}>{e.status.replace(/_/g, " ")}</Badge>{e.checksum && <span className="text-xs text-slate-400">sha256 {e.checksum.slice(0, 16)}…</span>}</div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Review</div>
          <div className="space-y-2 p-5">
            <DataTable columns={["Decision", "Comment"]} rows={reviews.map((r) => [r.decision, r.comment ?? "—"])} />
            <form action={decide("approved")} className="flex gap-2">
              <input name="comment" placeholder="Review comment…" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button className="rounded-lg bg-emerald-900 px-3 py-2 text-xs font-semibold text-white">Accept</button>
            </form>
            <div className="flex gap-2">
              <form action={decide("returned")} className="flex flex-1 gap-2"><input name="comment" placeholder="Return reason…" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" /><button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Return</button></form>
              <form action={decide("rejected")} className="flex flex-1 gap-2"><input name="comment" placeholder="Reject reason…" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" /><button className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700">Reject</button></form>
            </div>
          </div>
        </Card>
        <Card>
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Links & versions</div>
          <div className="p-5">
            <DataTable columns={["Linked entity", "ID"]} rows={links.map((l) => [`${l.entityType}`, String(l.entityId).slice(0, 8) + "…"])} />
            <DataTable columns={["Version", "At"]} rows={versions.map((v) => [`v${v.version}`, v.createdAt ? new Date(v.createdAt).toLocaleString() : "—"])} />
            <form action={async (f: FormData) => { "use server"; await linkEvidence(id, String(f.get("entityType")), String(f.get("entityId"))); }} className="mt-3 flex gap-2">
              <select name="entityType" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="metric_value">metric value</option><option value="assessment">assessment</option>
                <option value="control">control</option><option value="data_request">data request</option><option value="report">report</option>
              </select>
              <input name="entityId" required placeholder="Entity UUID" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold">Link</button>
            </form>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
