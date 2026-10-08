import { db } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { scoreReadiness, type AnswerScore } from "@/lib/engines";

/**
 * Recompute an assessment's dimension scores + overall band.
 * Heuristic mapping (documented, configurable via question weights):
 * - dimension = questionnaire section title
 * - yes/no & single_choice: full weight for affirmative, 0 otherwise
 * - rating/number/percentage: normalized to 0..weight (assumes 0–100 scale for numbers)
 * - text answers: full weight when non-empty
 * - critical = requirement criticality is critical/high (via mapping or direct link)
 */
export async function computeAssessmentScore(assessmentId: string) {
  if (!db) throw new Error("Database not configured.");
  const a = (await db.select().from(s.assessments).where(eq(s.assessments.id, assessmentId)).limit(1))[0];
  if (!a) throw new Error("Assessment not found.");
  const sections = await db.select().from(s.questionnaireSections).where(eq(s.questionnaireSections.questionnaireId, a.questionnaireId));
  const secName = new Map(sections.map((x) => [x.id, x.title]));
  const allQ = await db.select().from(s.questions);
  const qs = allQ.filter((q) => secName.has(q.sectionId));
  const answers = await db.select().from(s.assessmentAnswers).where(eq(s.assessmentAnswers.assessmentId, assessmentId));
  const amap = new Map(answers.map((x) => [x.questionId, x]));
  const reqs = await db.select().from(s.requirements);
  const reqCrit = new Map(reqs.map((r) => [r.id, r.criticality]));
  const mappings = await db.select().from(s.questionMappings);

  const items: AnswerScore[] = qs.map((q) => {
    const ans = amap.get(q.id);
    const w = Number(q.weight ?? 1);
    const raw = ans?.value as unknown;
    const str = typeof raw === "string" ? raw : raw != null ? JSON.stringify(raw) : "";
    let frac = 0;
    if (str.trim() !== "") {
      const low = str.trim().toLowerCase();
      if (["yes", "true", "1", "compliant", "complete"].includes(low)) frac = 1;
      else if (["no", "false", "0", "not started"].includes(low)) frac = 0;
      else if (!Number.isNaN(Number(low))) frac = Math.min(1, Math.max(0, Number(low) / 100));
      else frac = 0.5; // substantive text response: partial credit
    }
    const linked = mappings.filter((m) => m.questionId === q.id).map((m) => reqCrit.get(m.requirementId));
    if (q.requirementId) linked.push(reqCrit.get(q.requirementId));
    const critical = linked.some((c) => c === "critical" || c === "high") || (Number(q.weight ?? 0) >= 2 && Boolean(q.requiredEvidence));
    return { dimension: secName.get(q.sectionId) ?? "Metrics", score: frac * w, max: w, critical, answered: str.trim() !== "" };
  });

  const result = scoreReadiness(items);
  await db.delete(s.assessmentScores).where(eq(s.assessmentScores.assessmentId, assessmentId));
  for (const d of result.dims) {
    await db.insert(s.assessmentScores).values({ assessmentId, dimension: d.dimension, score: String(d.pct) as never, status: d.status.toLowerCase().replace(" ", "_") as never });
  }
  await db.update(s.assessments).set({
    score: String(result.overall) as never,
    readinessBand: result.band,
    hasCriticalGap: result.hasCriticalGap,
    updatedAt: new Date(),
  }).where(eq(s.assessments.id, assessmentId));
  return result;
}
