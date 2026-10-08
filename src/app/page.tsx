import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0d1f16] text-white">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-sm font-black text-emerald-950">eE</div>
          <span className="text-lg font-bold tracking-tight">entESG</span>
        </div>
        <div className="flex gap-2">
          <Link href="/login" className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">Sign in</Link>
          <Link href="/dashboard" className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400">Open platform</Link>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-6 py-14 sm:px-10 lg:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Enterprise ESG Management</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            The report is the output. Controlled data is the product.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-300">
            Assess readiness → plan → collect → validate → evidence → review → approve → disclose → assure → improve.
            Multi-tenant, RBAC-enforced, fully lineage-traced ESG data, GHG calculations, materiality, risks, controls, targets and reporting.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-[11px]">
            {["IFRS S1/S2", "GHG Protocol", "GRI", "ESRS", "SASB", "Assurance-ready"].map((t) => (
              <span key={t} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-semibold">{t}</span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
          <p className="text-sm font-bold">GreenHarvest Foods Nigeria Ltd. — live demo</p>
          <p className="mt-1 text-xs text-slate-300">Fictional FMCG/manufacturing data across Lagos, Ogun and Abuja.</p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[["68%", "Readiness"], ["12.5kt", "GHG 2026"], ["74%", "Evidence"]].map(([v, l]) => (
              <div key={l} className="rounded-xl bg-white/5 p-4"><p className="text-xl font-bold text-emerald-300">{v}</p><p className="text-[11px] text-slate-300">{l}</p></div>
            ))}
          </div>
          <Link href="/dashboard" className="mt-5 block rounded-lg bg-emerald-500 px-4 py-2.5 text-center text-sm font-bold text-emerald-950 hover:bg-emerald-400">Enter dashboard</Link>
          <p className="mt-3 text-[11px] text-slate-400">Demo logins after seed: admin@greenharvest.ng · esg.manager@greenharvest.ng (GreenHarvest2026!)</p>
        </div>
      </main>
      <footer className="px-6 py-5 text-[11px] text-slate-400 sm:px-10">Readiness scores are not legal compliance conclusions. Requires SME validation.</footer>
    </div>
  );
}
