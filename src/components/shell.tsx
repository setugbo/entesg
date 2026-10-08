"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Building2, ClipboardCheck, BookOpen, ListChecks,
  Gauge, Database, FileCheck2, Factory, Droplets, Flame, Users,
  ShieldCheck, AlertTriangle, Target, Rocket, Wallet, FileText,
  BadgeCheck, KanbanSquare, Bell, Settings, Stethoscope, ChevronRight,
} from "lucide-react";

const NAV: { section: string; items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] }[] = [
  { section: "Overview", items: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tasks", label: "Tasks & Approvals", icon: KanbanSquare },
    { href: "/notifications", label: "Notifications", icon: Bell },
  ]},
  { section: "Assess & Plan", items: [
    { href: "/assessments", label: "Assessments", icon: ClipboardCheck },
    { href: "/frameworks", label: "Frameworks", icon: BookOpen },
    { href: "/requirements", label: "Requirements", icon: ListChecks },
    { href: "/disclosures", label: "Disclosures", icon: FileCheck2 },
    { href: "/materiality", label: "Materiality", icon: Gauge },
  ]},
  { section: "Collect & Validate", items: [
    { href: "/metrics", label: "Metrics", icon: Database },
    { href: "/data-requests", label: "Data Requests", icon: FileText },
    { href: "/evidence", label: "Evidence", icon: FileCheck2 },
    { href: "/lineage", label: "Data Lineage", icon: ChevronRight },
  ]},
  { section: "Environmental", items: [
    { href: "/emissions", label: "GHG & Emissions", icon: Factory },
    { href: "/energy", label: "Energy", icon: Flame },
    { href: "/water", label: "Water", icon: Droplets },
    { href: "/waste", label: "Waste", icon: Database },
  ]},
  { section: "Social & Governance", items: [
    { href: "/social", label: "Social", icon: Users },
    { href: "/governance", label: "Governance", icon: ShieldCheck },
    { href: "/risks", label: "Risks", icon: AlertTriangle },
    { href: "/opportunities", label: "Opportunities", icon: Rocket },
    { href: "/controls", label: "Controls", icon: ShieldCheck },
  ]},
  { section: "Strategy & Disclosure", items: [
    { href: "/targets", label: "Targets", icon: Target },
    { href: "/net-zero", label: "Net Zero", icon: Rocket },
    { href: "/capex", label: "CapEx Alignment", icon: Wallet },
    { href: "/reports", label: "Reports", icon: FileText },
    { href: "/assurance", label: "Assurance", icon: BadgeCheck },
  ]},
  { section: "Manage", items: [
    { href: "/organisations", label: "Organisation", icon: Building2 },
    { href: "/consultant", label: "Consultant", icon: Stethoscope },
    { href: "/admin", label: "Admin & Audit", icon: Settings },
    { href: "/settings", label: "Settings", icon: Settings },
  ]},
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-[#0d1f16] text-slate-200 lg:flex">
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500 text-sm font-black text-emerald-950">eE</div>
        <div>
          <p className="text-sm font-bold tracking-tight text-white">entESG</p>
          <p className="text-[11px] text-emerald-200/70">Enterprise ESG Platform</p>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {NAV.map((g) => (
          <div key={g.section}>
            <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200/50">{g.section}</p>
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const active = path === it.href || path.startsWith(it.href + "/");
                const Icon = it.icon;
                return (
                  <Link key={it.href} href={it.href}
                    className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors",
                      active ? "bg-emerald-500/15 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white")}>
                    <Icon className={cn("h-4 w-4", active ? "text-emerald-300" : "text-slate-400")} />
                    {it.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4 text-[11px] leading-relaxed text-slate-400">
        Readiness ≠ legal compliance.<br />Requires SME validation.
      </div>
    </aside>
  );
}

export function Topbar({ user, orgName }: { user?: { name: string; email: string; roleKeys: string[] } | null; orgName?: string }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="font-semibold text-slate-800">{orgName ?? "GreenHarvest Foods Nigeria Ltd."}</span>
        <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 sm:inline">Lagos · Ogun · Abuja</span>
      </div>
      <div className="flex items-center gap-3">
        <form action="/api/auth/signout" method="post">
          <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50" title={user?.email}>
            {user ? `${user.name} · ${user.roleKeys[0] ?? "member"}` : "Demo mode"} — Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

export function MobileNav() {
  const path = usePathname();
  const flat = NAV.flatMap((g) => g.items).slice(0, 8);
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
      {flat.map((it) => (
        <Link key={it.href} href={it.href}
          className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold",
            path.startsWith(it.href) ? "bg-emerald-900 text-white" : "bg-slate-100 text-slate-600")}>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
