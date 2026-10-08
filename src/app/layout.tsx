import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "entESG — Enterprise ESG Management Platform",
  description: "Assess, collect, validate, evidence, review, approve, disclose and assure ESG data.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[#f8faf9] text-slate-900">{children}</body>
    </html>
  );
}
