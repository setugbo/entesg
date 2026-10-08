// Readiness scoring: dimension scores + critical-gap override.
// Never present as legal compliance — labels are readiness bands only.
export const DIMENSIONS = [
  "Governance", "Strategy", "Materiality", "Risk", "Metrics",
  "Data Completeness", "Evidence", "Controls", "Assurance", "Reporting",
] as const;

export type AnswerScore = { dimension: string; score: number; max: number; critical: boolean; answered: boolean };

export function scoreReadiness(items: AnswerScore[]) {
  const byDim: Record<string, { score: number; max: number; criticalGap: boolean }> = {};
  for (const d of DIMENSIONS) byDim[d] = { score: 0, max: 0, criticalGap: false };
  for (const it of items) {
    const slot = byDim[it.dimension] ?? (byDim[it.dimension] = { score: 0, max: 0, criticalGap: false });
    slot.max += it.max;
    slot.score += it.answered ? it.score : 0;
    if (it.critical && (!it.answered || it.score <= 0)) slot.criticalGap = true;
  }
  const dims = Object.entries(byDim).map(([dimension, v]) => {
    const pct = v.max > 0 ? Math.round((v.score / v.max) * 100) : 0;
    return {
      dimension, pct,
      status: v.criticalGap ? "Critical" : pct >= 80 ? "On Track" : pct >= 60 ? "Low" : pct >= 40 ? "Medium" : "High",
      criticalGap: v.criticalGap,
    };
  });
  const totals = Object.values(byDim).reduce((a, v) => ({ score: a.score + v.score, max: a.max + v.max }), { score: 0, max: 0 });
  const overall = totals.max > 0 ? Math.round((totals.score / totals.max) * 100) : 0;
  const anyCritical = Object.values(byDim).some((v) => v.criticalGap);
  return {
    overall, hasCriticalGap: anyCritical,
    band: anyCritical ? "CRITICAL GAP" : overall >= 80 ? "On Track" : overall >= 60 ? "Progressing" : overall >= 40 ? "Early" : "Nascent",
    dims,
    disclaimer: "Readiness score — not a legal compliance conclusion. Requires SME validation.",
  };
}

export function ghgTotal(outputs: Array<number | string>): number {
  return outputs.reduce<number>((a, v) => a + Number(v ?? 0), 0);
}

/** Activity × Factor = Emissions (tCO2e). factor in kgCO2e per unit. */
export function calcEmissions(activity: number, factorKg: number): number {
  return (Number(activity) * Number(factorKg)) / 1000;
}
