import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, Badge, DataTable } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { switchOrganisation, clearOrgSwitch } from "@/server/records";
import { redirect } from "next/navigation";

export default async function ConsultantPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  let clients: { id: string; name: string; industry?: string | null; active: boolean }[] = [];
  if (db) {
    try {
      if (user.roleKeys.includes("SUPER_ADMIN")) {
        const orgs = await db.select().from(s.organisations);
        clients = orgs.map((o) => ({ id: o.id, name: o.name, industry: o.industry, active: o.id === user.organisationId }));
      } else {
        const links = await db.select().from(s.consultantClients).where(eq(s.consultantClients.userId, user.id));
        for (const l of links) {
          const o = (await db.select().from(s.organisations).where(eq(s.organisations.id, l.organisationId)).limit(1))[0];
          if (o) clients.push({ id: o.id, name: o.name, industry: o.industry, active: o.id === user.organisationId });
        }
      }
    } catch { /* ignore */ }
  }
  if (!clients.length) {
    clients = [{ id: "demo", name: "GreenHarvest Foods Nigeria Ltd.", industry: "FMCG / Manufacturing", active: true }];
  }
  return (
    <AppShell>
      <PageHeader title="Consultant workspace" sub="Client list with secure switching. Every switch is server-validated against assignments; tenant isolation holds per active client."
        actions={<form action={async () => { "use server"; await clearOrgSwitch(); }}><button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Reset to home org</button></form>} />
      <Card>
        <DataTable columns={["Client", "Industry", "Context", ""]}
          rows={clients.map((c) => [c.name, c.industry ?? "—",
            c.active ? <Badge key={c.id} status="approved">active</Badge> : <Badge key={c.id} status="medium">assigned</Badge>,
            c.id === "demo" ? "—" : <form key={c.id} action={async () => { "use server"; await switchOrganisation(c.id); }}><button className="font-semibold text-emerald-800">Switch →</button></form>])} />
      </Card>
    </AppShell>
  );
}
