import { AppShell } from "@/components/app-shell";
import { PageHeader, Card } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { changePassword } from "@/server/records";
import { redirect } from "next/navigation";

export default async function PasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return (
    <AppShell>
      <PageHeader title="Change password" sub="Minimum 10 characters. All changes are audited." />
      <Card>
        <form action={changePassword} className="max-w-md space-y-3 p-5">
          <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Current password</span>
            <input name="current" type="password" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">New password (min 10 chars)</span>
            <input name="next" type="password" required minLength={10} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
          <button className="rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Update password</button>
        </form>
      </Card>
    </AppShell>
  );
}
