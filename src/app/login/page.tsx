import { signIn } from "@/server/actions";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const u = await getSessionUser();
  if (u) redirect("/dashboard");
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d1f16] p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-900 text-sm font-black text-white">eE</div>
          <div><p className="text-base font-bold text-slate-900">entESG</p><p className="text-[11px] text-slate-500">Enterprise ESG Management</p></div>
        </div>
        <h1 className="mt-6 text-xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-1 text-xs text-slate-500">Seeded demo: admin@greenharvest.ng / GreenHarvest2026!</p>
        <form action={signIn} className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
            <input name="email" type="email" required defaultValue="admin@greenharvest.ng" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Password</span>
            <input name="password" type="password" required defaultValue="GreenHarvest2026!" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15" />
          </label>
          <button className="w-full rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">Sign in</button>
        </form>
        <p className="mt-4 text-center text-[11px] text-slate-400">Tenant-isolated · RBAC-enforced · audited</p>
      </div>
    </div>
  );
}
