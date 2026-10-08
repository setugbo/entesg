import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, assertTenant } from "@/lib/auth";
import { reportPdf, reportDocx, toCsv } from "@/lib/exporters";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") ?? "csv";
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!db) return new Response("Database not configured", { status: 503 });
  const r = (await db.select().from(s.reports).where(eq(s.reports.id, id)).limit(1))[0];
  if (!r) return new Response("Not found", { status: 404 });
  try {
    assertTenant(user, r.organisationId);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  const { hasPermission } = await import("@/lib/permissions");
  if (!user.roleKeys.includes("SUPER_ADMIN") && !hasPermission(user.roleKeys, "report.export")) {
    return new Response("Insufficient permission (report.export)", { status: 403 });
  }
  const secs = (await db.select().from(s.reportSections).where(eq(s.reportSections.reportId, id)))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const links = await db.select().from(s.reportDataLinks).where(eq(s.reportDataLinks.reportId, id));
  const data = {
    title: r.title, status: r.status, period: r.period,
    sections: secs.map((x) => ({ title: x.title, content: x.content })),
    links: links.map((l) => ({ entityType: l.entityType, entityId: l.entityId })),
  };
  const { logAudit } = await import("@/lib/auth");
  await logAudit({ organisationId: r.organisationId, userId: user.id, action: `report.export.${format}`, entity: "report", entityId: id });
  const safe = r.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 60);
  if (format === "pdf") {
    const buf = await reportPdf(data);
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${safe}.pdf"` } });
  }
  if (format === "docx") {
    const buf = await reportDocx(data);
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${safe}.docx"` } });
  }
  const csv = toCsv(["section", "title", "content"], secs.map((x) => [x.position, x.title, (x.content ?? "").slice(0, 300)]));
  return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="report-${id}.csv"` } });
}
