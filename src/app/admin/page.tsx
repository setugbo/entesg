import { AppShell } from "@/components/app-shell";
import { PageHeader, Card, Badge, DataTable, Empty } from "@/components/ui";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { hasPermission, ROLES, ROLE_PERMISSIONS } from "@/lib/permissions";
import { createUser, assignConsultant, setUserStatus, setUserRole } from "@/server/records";
import { ResetPasswordButton } from "@/components/admin-actions";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.roleKeys.includes("SUPER_ADMIN") && !hasPermission(user.roleKeys, "user.view") && !hasPermission(user.roleKeys, "audit.view")) redirect("/forbidden");
  const canManage = user.roleKeys.includes("SUPER_ADMIN") || hasPermission(user.roleKeys, "user.manage");

  let users: { id: string; name: string; email: string; roles: string; status: string }[] = [];
  let audit: { action: string; entity?: string | null; at?: Date | null }[] = [];
  let orgs: { id: string; name: string }[] = [];
  if (db && user.organisationId) {
    try {
      const us = await db.select().from(s.users).limit(100);
      const urs = await db.select().from(s.userRoles);
      const rl = await db.select().from(s.roles);
      const scope = user.roleKeys.includes("SUPER_ADMIN") ? us : us.filter((u) => u.organisationId === user.organisationId);
      users = scope.map((u) => ({
        id: u.id, name: u.name, email: u.email, status: u.status,
        roles: urs.filter((x) => x.userId === u.id).map((x) => rl.find((r) => r.id === x.roleId)?.key ?? "?").join(", "),
      }));
      const scopeOrg = user.roleKeys.includes("SUPER_ADMIN") ? undefined : user.organisationId;
      const ev = await db.select().from(s.auditEvents).orderBy(desc(s.auditEvents.createdAt)).limit(60);
      audit = (scopeOrg ? ev.filter((e) => e.organisationId === scopeOrg) : ev).map((e) => ({ action: e.action, entity: e.entity ? `${e.entity}:${(e.entityId ?? "").slice(0, 8)}` : undefined, at: e.createdAt }));
      orgs = await db.select({ id: s.organisations.id, name: s.organisations.name }).from(s.organisations);
    } catch { /* ignore */ }
  }

  return (
    <AppShell>
      <PageHeader title="Admin & Audit" sub="User management, consultant assignments and the immutable audit trail (append-only; no edit or delete paths exist)." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Users ({users.length})</div>
          {users.length === 0 ? <div className="p-5"><Empty title="No users in scope" sub="Seed the database to load demo users." /></div> :
            <DataTable columns={["Name", "Email", "Roles", "Status", ...(canManage ? ["Manage"] : [])]} rows={users.map((u) => [u.name, u.email, u.roles || "—", u.status,
              ...(canManage ? [(
                <span key={u.id} className="flex flex-wrap items-center gap-1">
                  <form action={async () => { "use server"; await setUserStatus(u.id, u.status === "suspended" ? "active" : "suspended"); }}>
                    <button className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold">{u.status === "suspended" ? "Activate" : "Suspend"}</button>
                  </form>
                  <form action={async (f: FormData) => { "use server"; await setUserRole(u.id, f); }} className="flex gap-1">
                    <select name="role" defaultValue="" className="rounded border border-slate-300 px-1 py-1 text-[11px]">
                      <option value="" disabled>role…</option>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold">Set</button>
                  </form>
                  <ResetPasswordButton userId={u.id} />
                </span>
              )] : [])])} />}
          {canManage && (
            <form action={createUser} className="grid gap-2 border-t border-slate-100 p-5 sm:grid-cols-2">
              <input name="name" required placeholder="Full name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="email" type="email" required placeholder="Email" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input name="password" placeholder="Temp password (auto if blank)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <select name="role" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
              <div className="sm:col-span-2"><button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Invite user</button></div>
            </form>
          )}
        </Card>
        <div className="space-y-4">
          <Card>
            <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Audit trail (latest)</div>
            <DataTable columns={["Action", "Entity", "At"]} rows={audit.slice(0, 20).map((a) => [a.action, a.entity ?? "—", a.at ? new Date(a.at).toLocaleString() : "—"])} />
          </Card>
          {canManage && (
            <Card>
              <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Assign consultant to client</div>
              <form action={assignConsultant} className="grid gap-2 p-5 sm:grid-cols-2">
                <input name="userId" required placeholder="Consultant user UUID" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <select name="organisationId" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
                <div className="sm:col-span-2"><button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">Assign client</button></div>
              </form>
            </Card>
          )}
        </div>
      </div>
      <Card>
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold">Roles & permissions</div>
        <div className="grid gap-2 p-5 sm:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r} className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-bold">{r}</p>
              <p className="mt-1 text-[11px] text-slate-500">{(ROLE_PERMISSIONS[r] ?? []).length} permissions</p>
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
