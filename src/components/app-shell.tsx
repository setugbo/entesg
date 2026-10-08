import { getSessionUser } from "@/lib/auth";
import { Sidebar, Topbar, MobileNav } from "@/components/shell";
import { db } from "@/db";
import { organisations } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function AppShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const user = await getSessionUser();
  let orgName: string | undefined;
  if (db && user?.organisationId) {
    try {
      const rows = await db.select().from(organisations).where(eq(organisations.id, user.organisationId)).limit(1);
      orgName = rows[0]?.name;
    } catch { /* ignore */ }
  }
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} orgName={orgName} />
        <MobileNav />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          {!db && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
              <strong>Preview mode (no DATABASE_URL):</strong> showing seeded GreenHarvest demo data. Configure Neon/Local PostgreSQL, run migrations + seed for full persistence.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
