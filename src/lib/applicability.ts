// Applicability engine: decides whether a requirement/question applies to an org.
export type OrgProfile = {
  jurisdiction?: string | null;
  industry?: string | null;
  sector?: string | null;
  orgType?: string | null;
  sizeBand?: string | null;
  listed?: boolean | null;
  reportingFrameworks?: string[] | null;
};

export type Applicable = {
  applicability?: Record<string, unknown> | null;
  jurisdiction?: string | null;
  sector?: string | null;
};

function norm(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

export function isApplicable(item: Applicable, org: OrgProfile): boolean {
  const a = (item.applicability ?? {}) as Record<string, unknown>;
  // Explicit jurisdiction/sector columns act as filters when set.
  if (item.jurisdiction && norm(item.jurisdiction) !== "all" && org.jurisdiction) {
    if (norm(item.jurisdiction) !== norm(org.jurisdiction)) return false;
  }
  if (item.sector && norm(item.sector) !== "all" && org.sector) {
    if (norm(item.sector) !== norm(org.sector) && norm(item.sector) !== norm(org.industry)) return false;
  }
  // JSON applicability rules: each present key must match (arrays = any-of).
  for (const [k, v] of Object.entries(a)) {
    if (v === null || v === undefined || v === "" || v === "all") continue;
    const ov: unknown = (org as Record<string, unknown>)[k]
      ?? (org as Record<string, unknown>)[k.toLowerCase()];
    if (Array.isArray(v)) {
      if (Array.isArray(ov)) {
        if (!v.some((x) => (ov as unknown[]).map(norm).includes(norm(x)))) return false;
      } else if (!v.map(norm).includes(norm(ov))) return false;
    } else if (typeof v === "boolean") {
      if (Boolean(ov) !== v) return false;
    } else if (norm(v) !== norm(ov)) return false;
  }
  return true;
}

export function filterApplicable<T extends Applicable>(items: T[], org: OrgProfile): T[] {
  return items.filter((i) => isApplicable(i, org));
}
