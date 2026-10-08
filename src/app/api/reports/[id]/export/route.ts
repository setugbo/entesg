import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, assertTenant } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  let csv = "section,title,content\n";
  if (db) {
    try {
      const r = (await db.select().from(s.reports).where(eq(s.reports.id, id)).limit(1))[0];
      if (!r) return new Response("Not found", { status: 404 });
      assertTenant(user, r.organisationId);
      if (r.status !== "published" && !user.roleKeys.some((x) => ["SUPER_ADMIN", "ORGANISATION_ADMIN", "ESG_MANAGER", "AUDITOR"].includes(x)))
        return new Response("Report not published", { status: 403 });
      const secs = await db.select().from(s.reportSections).where(eq(s.reportSections.reportId, id));
      for (const x of secs) csv += `"${x.position}","${(x.title ?? "").replace(/"/g, "'")}","${(x.content ?? "").replace(/"/g, "'").slice(0, 200)}"\n`;
    } catch (e) {
      return new Response("Export unavailable (preview mode)", { status: 503 });
    }
  } else {
    csv += `"1","Governance & Strategy","preview"\n`;
  }
  return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="report-${id}.csv"` } });
}
