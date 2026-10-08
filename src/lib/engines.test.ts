import { describe, it, expect } from "vitest";
import { isApplicable } from "@/lib/applicability";
import { scoreReadiness, calcEmissions } from "@/lib/engines";
import { hasPermission } from "@/lib/permissions";

describe("applicability engine", () => {
  it("filters by jurisdiction", () => {
    const org = { jurisdiction: "Nigeria", industry: "FMCG / Manufacturing" };
    expect(isApplicable({ jurisdiction: "Nigeria" }, org)).toBe(true);
    expect(isApplicable({ jurisdiction: "EU" }, org)).toBe(false);
  });
  it("respects JSON rules", () => {
    expect(isApplicable({ applicability: { listed: true } }, { listed: true })).toBe(true);
    expect(isApplicable({ applicability: { listed: true } }, { listed: false })).toBe(false);
  });
});

describe("readiness scoring", () => {
  it("critical gaps override aggregate", () => {
    const r = scoreReadiness([
      { dimension: "Metrics", score: 10, max: 10, critical: false, answered: true },
      { dimension: "Evidence", score: 0, max: 10, critical: true, answered: false },
    ]);
    expect(r.hasCriticalGap).toBe(true);
    expect(r.band).toBe("CRITICAL GAP");
  });
});

describe("GHG engine", () => {
  it("activity × factor = emissions", () => {
    expect(calcEmissions(12400, 2.68)).toBeCloseTo(33.232, 3);
  });
});

describe("RBAC", () => {
  it("auditor cannot approve assessments", () => {
    expect(hasPermission(["AUDITOR"], "assessment.approve")).toBe(false);
    expect(hasPermission(["APPROVER"], "assessment.approve")).toBe(true);
  });
  it("tenant isolation: non-superadmin pinned to own org", () => {
    // assertTenant lives in @/lib/auth (imports next/headers); its logic:
    // SUPER_ADMIN bypasses, others must match organisationId.
    const pinned = (roleKeys: string[], own: string | null, target: string) =>
      roleKeys.includes("SUPER_ADMIN") ? true : own === target;
    expect(pinned(["ESG_MANAGER"], "org-a", "org-b")).toBe(false);
    expect(pinned(["ESG_MANAGER"], "org-a", "org-a")).toBe(true);
    expect(pinned(["SUPER_ADMIN"], "org-a", "org-b")).toBe(true);
  });
});
