import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, logAudit } from "@/lib/auth";
import { toCsv } from "@/lib/exporters";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!db || !user.organisationId) return new Response("Database not configured", { status: 503 });
  const { hasPermission } = await import("@/lib/permissions");
  if (!user.roleKeys.includes("SUPER_ADMIN") && !hasPermission(user.roleKeys, "report.export")) {
    return new Response("Insufficient permission (report.export)", { status: 403 });
  }
  const metrics = await db.select().from(s.metrics);
  const mine = new Map(metrics.filter((m) => !m.organisationId || m.organisationId === user.organisationId).map((m) => [m.id, m]));
  const vals = await db.select().from(s.metricValues).where(eq(s.metricValues.organisationId, user.organisationId)).limit(2000);
  const sites = new Map((await db.select().from(s.sites)).map((x) => [x.id, x.name]));
  const csv = toCsv(
    ["metric_code", "metric_name", "period", "value", "status", "site"],
    vals.map((v) => [mine.get(v.metricId)?.code ?? v.metricId.slice(0, 8), mine.get(v.metricId)?.name ?? "", v.period, String(v.value), v.status, (v.siteId && sites.get(v.siteId)) ?? "group"]),
  );
  await logAudit({ organisationId: user.organisationId, userId: user.id, action: "metric.export.csv", entity: "metric_value", entityId: `${vals.length}` });
  return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="metrics-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
