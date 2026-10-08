import { AppShell } from "@/components/app-shell";
import { PageHeader, Card } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function UploadEvidencePage() {
  const user = await getSessionUser();
  let linkHint = "Optionally link at upload: entityType:entityId (e.g. data_request:uuid).";
  return (
    <AppShell>
      <PageHeader title="Upload evidence" sub="PDF, Excel, Word, CSV, images — max 25MB. Stored privately (R2/S3 signed URLs or local private store). Identical re-uploads create a new version." />
      {!process.env.S3_BUCKET && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          <strong>Local storage mode:</strong> S3/R2 is not configured, so uploads persist on this server's disk only (ephemeral on Vercel). Set <code>S3_ENDPOINT / S3_BUCKET / S3 keys</code> for durable private storage.
        </div>
      )}
      <Card>
        {!db || !user ? (
          <p className="p-5 text-sm text-amber-800">Uploads require a configured database. Set DATABASE_URL, migrate and seed first.</p>
        ) : (
          <form action="/api/evidence/upload" method="post" encType="multipart/form-data" className="grid gap-3 p-5 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">File</span>
              <input name="file" type="file" required accept=".pdf,.xls,.xlsx,.doc,.docx,.csv,.txt,.png,.jpg,.jpeg" className="w-full text-sm" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Display name</span>
              <input name="name" placeholder="Defaults to filename" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Period (YYYY-MM)</span>
              <input name="period" placeholder="2026-09" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Source</span>
              <input name="source" placeholder="e.g. PHCN bill, delivery note" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Link (optional)</span>
              <input name="link" placeholder="metric_value:uuid" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
            <div className="sm:col-span-2"><button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Upload privately</button>
              <p className="mt-2 text-xs text-slate-400">{linkHint}</p></div>
          </form>
        )}
      </Card>
    </AppShell>
  );
}
