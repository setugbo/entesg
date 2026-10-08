import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, logAudit } from "@/lib/auth";
import { putObject, newStorageKey, ensureUploadsDir } from "@/lib/storage";
import { createHash } from "node:crypto";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set([
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv", "text/plain",
  "image/png", "image/jpeg",
]);

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return new Response("Unauthorized", { status: 401 });
  if (!db) return new Response("Database not configured", { status: 503 });
  if (!me.organisationId) return new Response("No organisation context", { status: 400 });
  const { hasPermission } = await import("@/lib/permissions");
  if (!me.roleKeys.includes("SUPER_ADMIN") && !hasPermission(me.roleKeys, "evidence.upload")) {
    return new Response("Insufficient permission (evidence.upload)", { status: 403 });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return new Response("Missing file", { status: 400 });
  if (file.size > MAX_BYTES) return new Response("File too large (max 25MB)", { status: 413 });
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) return new Response(`File type not allowed: ${mime}`, { status: 415 });
  const buf = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buf).digest("hex");
  // Deduplicate identical uploads per org (same checksum → new version of existing record).
  const existing = await db.select().from(s.evidence);
  const same = existing.find((e) => e.organisationId === me.organisationId && e.checksum === checksum);
  await ensureUploadsDir();
  const key = newStorageKey(me.organisationId, file.name);
  await putObject(key, buf, mime);

  if (same) {
    const version = (same.version ?? 1) + 1;
    await db.update(s.evidence).set({ version, status: "uploaded", storageKey: key }).where(eq(s.evidence.id, same.id));
    await db.insert(s.evidenceVersions).values({ evidenceId: same.id, version, storageKey: key, uploadedBy: me.id });
    await logAudit({ organisationId: me.organisationId, userId: me.id, action: "evidence.version", entity: "evidence", entityId: same.id, newValue: { version } });
    return Response.redirect(new URL('/evidence', req.url), 303);
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  const [e] = await db.insert(s.evidence).values({
    organisationId: me.organisationId,
    name: String(form.get("name") || file.name),
    type: ext, mimeType: mime, storageKey: key, sizeBytes: file.size,
    source: String(form.get("source") || ""), period: String(form.get("period") || ""),
    ownerId: me.id, uploadedBy: me.id, version: 1, status: "uploaded",
    checksum,
  }).returning();
  const linkTo = form.get("link");
  if (linkTo) {
    const [entityType, entityId] = String(linkTo).split(":");
    if (entityType && entityId) await db.insert(s.evidenceLinks).values({ evidenceId: e.id, entityType, entityId: entityId as never });
  }
  await logAudit({ organisationId: me.organisationId, userId: me.id, action: "evidence.upload", entity: "evidence", entityId: e.id, newValue: { name: e.name, size: file.size } });
  return Response.redirect(new URL('/evidence', req.url), 303);
}

