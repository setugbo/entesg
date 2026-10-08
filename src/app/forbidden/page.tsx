import Link from "next/link";
export default function Forbidden() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="text-center">
        <p className="text-5xl font-black text-slate-200">403</p>
        <h1 className="mt-2 text-lg font-semibold">Access denied</h1>
        <p className="mt-1 text-sm text-slate-500">Your role does not include this permission (server-enforced).</p>
        <Link href="/dashboard" className="mt-4 inline-block rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">Back to dashboard</Link>
      </div>
    </div>
  );
}
