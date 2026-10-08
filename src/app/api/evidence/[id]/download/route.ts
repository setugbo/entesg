import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, assertTenant, logAudit } from "@/lib/auth";
import { getObject, signedDownloadUrl } from "@/lib/storage";

/** Private download: auth + tenant enforced. S3 mode redirects to a 15-min signed URL. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getSessionUser();
  if (!me) return new Response("Unauthorized", { status: 401 });
  if (!db) return new Response("Database not configured", { status: 503 });
  const e = (await db.select().from(s.evidence).where(eq(s.evidence.id, id)).limit(1))[0];
  if (!e) return new Response("Not found", { status: 404 });
  try {
    assertTenant(me, e.organisationId);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  await logAudit({ organisationId: e.organisationId, userId: me.id, action: "evidence.download", entity: "evidence", entityId: id });
  if (process.env.S3_BUCKET) {
    const url = await signedDownloadUrl(e.storageKey, e.id);
    return Response.redirect(url, 302);
  }
  const obj = await getObject(e.storageKey);
  if (!obj) return new Response("File missing from storage", { status: 410 });
  return new Response(new Uint8Array(obj.body), {
    headers: {
      "Content-Type": e.mimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${(e.name ?? "evidence").replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
