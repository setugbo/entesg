// entESG seed — GreenHarvest Foods Nigeria Ltd. (fictional demo data only)
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as s from "./schema";
import { hash } from "../server/password";
import { eq } from "drizzle-orm";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required for seeding.");
  process.exit(1);
}

const client = postgres(url, { prepare: false, max: 5 });
const db = drizzle(client, { schema: s });

const ORG_SLUG = "greenharvest-foods";

async function main() {
  console.log("Seeding GreenHarvest Foods Nigeria Ltd...");

  // Organisation
  let org = (await db.select().from(s.organisations)).find((o) => o.slug === ORG_SLUG);
  if (!org) {
    [org] = await db.insert(s.organisations).values({
      name: "GreenHarvest Foods Nigeria Ltd.", slug: ORG_SLUG,
      country: "Nigeria", jurisdiction: "Nigeria", industry: "FMCG / Manufacturing",
      sector: "Food & Beverage", orgType: "private", sizeBand: "large", listed: false,
      reportingFrameworks: ["IFRS S1", "IFRS S2", "GHG Protocol", "GRI"],
    }).returning();
  }
  await db.insert(s.organisationSettings).values({ organisationId: org.id, baseYear: 2023, currency: "NGN", internalCarbonPrice: "15000" }).onConflictDoNothing();

  // Entities / sites / departments
  const [entity] = await db.insert(s.businessEntities).values({ organisationId: org.id, name: "GreenHarvest Manufacturing", code: "GHM" }).returning().catch(() => db.select().from(s.businessEntities).then((r) => [r[0]] as never) as never);
  const ent = Array.isArray(entity) ? entity : [entity];
  const entId = (await db.select().from(s.businessEntities))[0]?.id;
  for (const site of [{ name: "Lagos Plant — Ikeja", city: "Lagos", state: "Lagos" }, { name: "Ogun Factory — Agbara", city: "Agbara", state: "Ogun" }, { name: "Abuja Depot & Office", city: "Abuja", state: "FCT" }]) {
    const exists = (await db.select().from(s.sites)).some((x) => x.organisationId === org.id && x.name === site.name);
    if (!exists) await db.insert(s.sites).values({ organisationId: org.id, entityId: entId ?? null, ...site });
  }
  for (const d of ["Finance", "HR", "Procurement", "Operations", "HSE", "Facilities", "Legal", "Risk", "IT", "Corporate Affairs", "Supply Chain"]) {
    const exists = (await db.select().from(s.departments)).some((x) => x.organisationId === org.id && x.name === d);
    if (!exists) await db.insert(s.departments).values({ organisationId: org.id, name: d });
  }

  // Roles + permissions
  const { ROLE_PERMISSIONS, PERMISSIONS } = await import("../lib/permissions");
  for (const p of PERMISSIONS) {
    await db.insert(s.permissions).values({ key: p }).onConflictDoNothing();
  }
  for (const rk of Object.keys(ROLE_PERMISSIONS)) {
    let role = (await db.select().from(s.roles).where(eq(s.roles.key, rk)))[0];
    if (!role) [role] = await db.insert(s.roles).values({ key: rk, name: rk.replace(/_/g, " ") }).returning();
    const perms = await db.select().from(s.permissions);
    for (const pk of ROLE_PERMISSIONS[rk]) {
      const perm = perms.find((p) => p.key === pk);
      if (!perm) continue;
      await db.insert(s.rolePermissions).values({ roleId: role.id, permissionId: perm.id }).onConflictDoNothing();
    }
  }

  // Users
  const pw = await hash("GreenHarvest2026!");
  const people: { name: string; email: string; role: string }[] = [
    { name: "Adaeze Okafor", email: "admin@greenharvest.ng", role: "ORGANISATION_ADMIN" },
    { name: "Tunde Bakare", email: "esg.manager@greenharvest.ng", role: "ESG_MANAGER" },
    { name: "Funke Adeyemi", email: "analyst@greenharvest.ng", role: "ESG_ANALYST" },
    { name: "Ibrahim Bello", email: "operations@greenharvest.ng", role: "DATA_OWNER" },
    { name: "Ngozi Eze", email: "hse@greenharvest.ng", role: "DATA_OWNER" },
    { name: "Chidi Nwosu", email: "reviewer@greenharvest.ng", role: "REVIEWER" },
    { name: "Amina Yusuf", email: "approver@greenharvest.ng", role: "APPROVER" },
    { name: "Olumide Ajayi", email: "auditor@greenharvest.ng", role: "AUDITOR" },
    { name: "Grace Mbadiwe", email: "exec@greenharvest.ng", role: "EXECUTIVE" },
    { name: "Consult Ade", email: "consultant@partner.ng", role: "CONSULTANT" },
  ];
  for (const p of people) {
    let u = (await db.select().from(s.users).where(eq(s.users.email, p.email)))[0];
    if (!u) [u] = await db.insert(s.users).values({ name: p.name, email: p.email, passwordHash: pw, organisationId: org.id, emailVerified: true }).returning();
    const role = (await db.select().from(s.roles).where(eq(s.roles.key, p.role)))[0];
    if (role) await db.insert(s.userRoles).values({ userId: u.id, roleId: role.id, organisationId: org.id }).onConflictDoNothing();
  }

  // Frameworks + versions + requirements (configurable regulatory records, SME-validation flagged)
  const fwSeed = [
    { code: "IFRS S1", name: "IFRS S1 — General Requirements", v: "2024" },
    { code: "IFRS S2", name: "IFRS S2 — Climate-related Disclosures", v: "2024" },
    { code: "GHG Protocol", name: "GHG Protocol Corporate Standard", v: "Corporate Standard" },
    { code: "GRI", name: "GRI Universal Standards", v: "2021" },
    { code: "ESRS", name: "European Sustainability Reporting Standards", v: "E1–E5/S/G" },
    { code: "SASB", name: "SASB — Food & Beverage", v: "2023" },
  ];
  const reqTopics: [string, string, string][] = [
    ["Governance", "Board oversight of ESG risks", "high"], ["Strategy", "Climate transition plan", "high"],
    ["Materiality", "Double materiality process", "critical"], ["Risk", "Climate risk register", "high"],
    ["Metrics", "Scope 1 disclosure by source", "critical"], ["Metrics", "Scope 2 location & market based", "critical"],
    ["Data Completeness", "Monthly activity data coverage", "medium"], ["Evidence", "Evidence linkage for disclosures", "critical"],
    ["Controls", "Data validation controls", "high"], ["Assurance", "Assurance readiness file", "medium"],
  ];
  for (const f of fwSeed) {
    let fw = (await db.select().from(s.frameworks).where(eq(s.frameworks.code, f.code)))[0];
    if (!fw) [fw] = await db.insert(s.frameworks).values({ code: f.code, name: f.name, publisher: f.code }).returning();
    let fv = (await db.select().from(s.frameworkVersions))[0];
    const existing = await db.select().from(s.frameworkVersions).where(eq(s.frameworkVersions.frameworkId, fw.id));
    if (!existing.length) {
      [fv] = await db.insert(s.frameworkVersions).values({ frameworkId: fw.id, version: f.v, jurisdiction: f.code === "ESRS" ? "EU" : "Global" }).returning();
    } else fv = existing[0];
    for (const [topic, title, crit] of reqTopics.slice(0, 6)) {
      await db.insert(s.requirements).values({
        frameworkVersionId: fv.id, code: `${f.code}-${topic.slice(0, 3).toUpperCase()}`, title: `${f.code}: ${title}`,
        topic, criticality: crit as never, jurisdiction: "Global",
        sourceOrg: f.code, validationStatus: "REQUIRES SME VALIDATION",
      }).onConflictDoNothing();
    }
  }

  // Questionnaire + sections + questions
  let qn = (await db.select().from(s.questionnaires))[0];
  if (!qn) {
    [qn] = await db.insert(s.questionnaires).values({ organisationId: org.id, title: "ESG Readiness Assessment 2026", description: "Cross-framework readiness across 10 dimensions." }).returning();
    const sections = ["Governance", "Strategy", "Materiality", "Risk", "Metrics", "Data Completeness", "Evidence", "Controls", "Assurance", "Reporting"];
    let pos = 0;
    for (const sec of sections) {
      const [secRow] = await db.insert(s.questionnaireSections).values({ questionnaireId: qn.id, title: sec, position: pos++ }).returning();
      await db.insert(s.questions).values([
        { sectionId: secRow.id, code: `${sec.slice(0, 3).toUpperCase()}-01`, text: `${sec}: policy and ownership defined?`, type: "yes_no", weight: "2", position: 0 },
        { sectionId: secRow.id, code: `${sec.slice(0, 3).toUpperCase()}-02`, text: `${sec}: describe current maturity and gaps.`, type: "long_text", weight: "1", position: 1 },
        { sectionId: secRow.id, code: `${sec.slice(0, 3).toUpperCase()}-03`, text: `${sec}: attach supporting evidence.`, type: "evidence_required", weight: "2", requiredEvidence: true, position: 2 },
      ]);
    }
  }

  // Metrics + units + categories
  for (const [n, p] of [["Energy", "Environmental"], ["Water", "Environmental"], ["Waste", "Environmental"], ["GHG", "Environmental"], ["Workforce", "Social"], ["Health & Safety", "Social"], ["Board & Ethics", "Governance"]]) {
    if (!(await db.select().from(s.metricCategories)).some((c) => c.name === n)) {
      await db.insert(s.metricCategories).values({ name: n, pillar: p });
    }
  }
  for (const [c, l] of [["kWh", "kilowatt-hour"], ["L", "litre"], ["m3", "cubic metre"], ["t", "tonne"], ["tCO2e", "tonnes CO2e"], ["headcount", "headcount"], ["%", "percent"], ["NGN", "naira"]]) {
    if (!(await db.select().from(s.metricUnits)).some((u) => u.code === c)) {
      await db.insert(s.metricUnits).values({ code: c, label: l });
    }
  }
  const cats = await db.select().from(s.metricCategories);
  const units = await db.select().from(s.metricUnits);
  const ucode = (c: string) => units.find((u) => u.code === c)?.id;
  const metricDefs = [
    ["ELC", "Electricity consumption", "Energy", "kWh"], ["DSL", "Diesel consumption", "Energy", "L"],
    ["NGAS", "Natural gas consumption", "Energy", "m3"], ["LPG", "LPG consumption", "Energy", "kg"],
    ["WTR", "Water abstraction", "Water", "m3"], ["WST", "Waste generated", "Waste", "t"],
    ["S1", "Scope 1 GHG emissions", "GHG", "tCO2e"], ["S2", "Scope 2 GHG emissions", "GHG", "tCO2e"],
    ["HC", "Total headcount", "Workforce", "headcount"], ["TRN", "Training hours", "Workforce", "hours"],
    ["LTIR", "Lost-time injury rate", "Health & Safety", "%"], ["BRD", "Board independence", "Board & Ethics", "%"],
  ];
  for (const [code, name, cat, unit] of metricDefs) {
    const existing = (await db.select().from(s.metrics)).find((m) => m.code === code && (m.organisationId === org.id || m.isGlobal));
    if (!existing) {
      await db.insert(s.metrics).values({
        organisationId: org.id, code, name,
        categoryId: cats.find((c) => c.name === cat)?.id,
        unitId: ucode(unit) ?? ucode("kWh"), frequency: "monthly", source: "Operations",
      });
    }
  }

  // Emission factors + methodology
  let meth = (await db.select().from(s.methodologies).where(eq(s.methodologies.code, "GHG-PROTOCOL")))[0];
  if (!meth) [meth] = await db.insert(s.methodologies).values({ code: "GHG-PROTOCOL", name: "GHG Protocol Corporate Standard", version: "1.0" }).returning();
  let src = (await db.select().from(s.emissionFactorSources))[0];
  if (!src) [src] = await db.insert(s.emissionFactorSources).values({ name: "DEFRA/BEIS indicative factors (seed — validate before assurance)", year: 2024 }).returning();
  const factors: [string, string, string, string, string][] = [
    ["DSL-L", "Diesel", "L", "Scope 1", "2.680"], ["NGAS-M3", "Natural gas", "m3", "Scope 1", "2.030"],
    ["LPG-KG", "LPG", "kg", "Scope 1", "2.940"], ["GRID-NG-KWH", "Grid electricity (Nigeria)", "kWh", "Scope 2", "0.439"],
    ["PETROL-L", "Petrol (vehicles)", "L", "Scope 1", "2.310"], ["HFO-L", "HFO (backup gens)", "L", "Scope 1", "3.110"],
  ];
  for (const [code, fuel, unit, scope, f] of factors) {
    const ex = (await db.select().from(s.emissionFactors).where(eq(s.emissionFactors.code, code)))[0];
    if (!ex) await db.insert(s.emissionFactors).values({ code, fuel, unit, scope, factorKgco2e: f, sourceId: src.id, version: "2024-seed" });
  }

  // Materiality assessment + topics
  let ma = (await db.select().from(s.materialityAssessments).where(eq(s.materialityAssessments.organisationId, org.id)))[0];
  if (!ma) {
    [ma] = await db.insert(s.materialityAssessments).values({ organisationId: org.id, title: "Double Materiality 2026", year: 2026, status: "in_progress" }).returning();
    for (const t of [
      ["GHG emissions & energy", "Environmental", 4, 4], ["Water stewardship", "Environmental", 4, 3],
      ["Food safety & quality", "Social", 4, 4], ["Workforce H&S", "Social", 3, 3],
      ["Packaging & waste", "Environmental", 3, 3], ["Business ethics", "Governance", 3, 4],
    ] as const) {
      await db.insert(s.materialityTopics).values({
        assessmentId: ma.id, topic: t[0], category: t[1], impactScore: t[2], financialScore: t[3],
        combinedScore: String(((t[2] + t[3]) / 2).toFixed(1)) as never,
        decision: t[2] >= 3 || t[3] >= 3 ? "material" : "monitor", rationale: "Seed assessment — requires stakeholder validation.",
      });
    }
  }

  // Risks + controls + targets + report
  const riskSeed = [["NAPs carbon pricing exposure on diesel fleet", "Climate"], ["Water stress — Ogun abstraction licence", "Environmental"], ["ESRS / IFRS disclosure timetable slippage", "Regulatory"]];
  for (const [title, cat] of riskSeed) {
    const ex = (await db.select().from(s.risks).where(eq(s.risks.organisationId, org.id))).find((r) => r.title === title);
    if (!ex) {
      const [r] = await db.insert(s.risks).values({ organisationId: org.id, title, category: cat }).returning();
      await db.insert(s.riskAssessments).values({ riskId: r.id, likelihood: 4, impact: 4, inherentRisk: 16, controlEffectiveness: 2, residualRisk: 12 });
    }
  }
  for (const [code, title] of [["CTL-ENV-01", "Monthly meter-reading reconciliation"], ["CTL-DAT-02", "Evidence linkage before metric approval"], ["CTL-GHG-03", "Emission-factor version lock per run"]] as const) {
    const ex = (await db.select().from(s.controls).where(eq(s.controls.organisationId, org.id))).find((c) => c.code === code);
    if (!ex) await db.insert(s.controls).values({ organisationId: org.id, code, title });
  }
  for (const t of [["Scope 1+2 −30% by 2030 (2023 base)", "absolute reduction"], ["Renewable electricity 60% by 2028", "renewable energy"], ["Zero waste to landfill by 2027", "waste reduction"]] as const) {
    const ex = (await db.select().from(s.targets).where(eq(s.targets.organisationId, org.id))).find((x) => x.title === t[0]);
    if (!ex) await db.insert(s.targets).values({ organisationId: org.id, title: t[0], kind: t[1], baselineYear: 2023, targetYear: 2030 });
  }

  // Live workflow trail (real records across the full lifecycle)
  const analyst = (await db.select().from(s.users).where(eq(s.users.email, "analyst@greenharvest.ng")))[0];
  const manager = (await db.select().from(s.users).where(eq(s.users.email, "esg.manager@greenharvest.ng")))[0];
  const approver = (await db.select().from(s.users).where(eq(s.users.email, "approver@greenharvest.ng")))[0];
  const ops = (await db.select().from(s.users).where(eq(s.users.email, "operations@greenharvest.ng")))[0];
  const hse = (await db.select().from(s.users).where(eq(s.users.email, "hse@greenharvest.ng")))[0];
  const reviewerU = (await db.select().from(s.users).where(eq(s.users.email, "reviewer@greenharvest.ng")))[0];
  const siteList = await db.select().from(s.sites);
  const lagos = siteList.find((x) => x.name.includes("Lagos"));
  const ogun = siteList.find((x) => x.name.includes("Ogun"));

  let assess = (await db.select().from(s.assessments).where(eq(s.assessments.organisationId, org.id))).find((a) => a.title.includes("Q3 2026"));
  if (!assess && qn && analyst) {
    [assess] = await db.insert(s.assessments).values({
      organisationId: org.id, questionnaireId: qn.id, title: "IFRS S1/S2 Readiness — Q3 2026",
      status: "under_review", ownerId: analyst.id, reviewerId: (await db.select().from(s.users).where(eq(s.users.email, "reviewer@greenharvest.ng")))[0]?.id ?? null,
    }).returning();
    const qs = await db.select().from(s.questions);
    for (const q of qs.filter((x) => x.type === "yes_no").slice(0, 8)) {
      await db.insert(s.assessmentAnswers).values({ assessmentId: assess.id, questionId: q.id, value: "yes" as never, score: "1" as never, answeredBy: analyst.id });
    }
    for (const q of qs.filter((x) => x.type === "long_text").slice(0, 4)) {
      await db.insert(s.assessmentAnswers).values({ assessmentId: assess.id, questionId: q.id, value: "Documented process in place; evidence filed in the library." as never, answeredBy: analyst.id });
    }
    const { computeAssessmentScore } = await import("../server/scoring");
    await computeAssessmentScore(assess.id);
  }
  // Accountability + per-question assignment (the delegation model; runs on fresh and repeat seeds)
  assess = (await db.select().from(s.assessments).where(eq(s.assessments.organisationId, org.id))).find((a) => a.title.includes("Q3 2026"));
  if (assess) {
    await db.update(s.assessments).set({
      ownerId: analyst?.id ?? null, reviewerId: reviewerU?.id ?? null, approverId: approver?.id ?? null,
    }).where(eq(s.assessments.id, assess.id));
    const qnSecs = await db.select().from(s.questionnaireSections).where(eq(s.questionnaireSections.questionnaireId, assess.questionnaireId));
    const opsSecs = new Set(qnSecs.filter((x) => ["Metrics", "Data Completeness", "Evidence"].includes(x.title)).map((x) => x.id));
    const allQs = await db.select().from(s.questions);
    for (const q of allQs.filter((x) => opsSecs.has(x.sectionId))) {
      if (!q.ownerId && ops) await db.update(s.questions).set({ ownerId: ops.id }).where(eq(s.questions.id, q.id));
    }
    for (const q of allQs.filter((x) => !opsSecs.has(x.sectionId) && qnSecs.some((sec) => sec.id === x.sectionId))) {
      if (!q.ownerId && analyst) await db.update(s.questions).set({ ownerId: analyst.id }).where(eq(s.questions.id, q.id));
    }
    if (hse) {
      const evi = allQs.find((x) => x.code === "EVI-01");
      if (evi && !evi.ownerId) await db.update(s.questions).set({ ownerId: hse.id }).where(eq(s.questions.id, evi.id));
    }
  }

  const reqSeed: [string, string, string, string][] = [
    ["Submit electricity consumption — Lagos Plant — August 2026", "sent", "2026-09-10", "high"],
    ["Submit diesel consumption — Ogun fleet — August 2026", "submitted", "2026-09-08", "critical"],
    ["Submit water abstraction — Ogun — August 2026", "validated", "2026-09-08", "medium"],
  ];
  for (const [title, status, due, pri] of reqSeed) {
    const exists = (await db.select().from(s.dataRequests).where(eq(s.dataRequests.organisationId, org.id))).some((r) => r.title === title);
    if (!exists) {
      await db.insert(s.dataRequests).values({
        organisationId: org.id, title, period: "2026-08", dueDate: due, priority: pri,
        status: status as never, ownerId: ops?.id ?? null, createdBy: manager?.id ?? null,
      });
    }
  }

  const metricList = await db.select().from(s.metrics);
  const elc = metricList.find((m) => m.code === "ELC" && m.organisationId === org.id)?.id;
  const dsl = metricList.find((m) => m.code === "DSL" && m.organisationId === org.id)?.id;
  const wtr = metricList.find((m) => m.code === "WTR" && m.organisationId === org.id)?.id;
  const mvSeed: [string | undefined, string, number, string, string | undefined][] = [
    [elc, "2026-08", 84200, "submitted", lagos?.id],
    [dsl, "2026-08", 12400, "validated", ogun?.id],
    [wtr, "2026-08", 9800, "approved", lagos?.id],
  ];
  for (const [mid, period, val, status, site] of mvSeed) {
    if (!mid) continue;
    const exists = (await db.select().from(s.metricValues).where(eq(s.metricValues.organisationId, org.id))).some((v) => v.metricId === mid && v.period === period);
    if (!exists) {
      await db.insert(s.metricValues).values({
        organisationId: org.id, metricId: mid, period, value: String(val) as never, siteId: site ?? null,
        status: status as never, submittedBy: ops?.id ?? null,
        reviewedBy: status !== "submitted" ? manager?.id ?? null : null,
        approvedBy: status === "approved" ? approver?.id ?? null : null,
      });
    }
  }

  const dslFactor = (await db.select().from(s.emissionFactors).where(eq(s.emissionFactors.code, "DSL-L")))[0];
  const gridFactor = (await db.select().from(s.emissionFactors).where(eq(s.emissionFactors.code, "GRID-NG-KWH")))[0];
  let run = (await db.select().from(s.calculationRuns).where(eq(s.calculationRuns.organisationId, org.id))).find((r) => r.period === "2026-08" && r.scope === "Scope 1");
  if (!run && dslFactor && manager) {
    [run] = await db.insert(s.calculationRuns).values({ organisationId: org.id, methodologyId: meth.id, scope: "Scope 1", period: "2026-08", status: "approved", createdBy: manager.id }).returning();
    const t = (12400 * Number(dslFactor.factorKgco2e)) / 1000;
    const [ci] = await db.insert(s.calculationInputs).values({ runId: run.id, activityData: "12400" as never, unit: "L", factorId: dslFactor.id, siteId: ogun?.id ?? null, label: "Diesel — Ogun fleet — Aug 2026" }).returning();
    await db.insert(s.calculationOutputs).values({ runId: run.id, inputId: ci.id, emissionsTco2e: String(t) as never, detail: { factor: dslFactor.code, methodology: "GHG Protocol" } as never });
    await db.update(s.calculationRuns).set({ totalTco2e: String(t) as never }).where(eq(s.calculationRuns.id, run.id));
  }
  let run2 = (await db.select().from(s.calculationRuns).where(eq(s.calculationRuns.organisationId, org.id))).find((r) => r.period === "2026-08" && r.scope === "Scope 2");
  if (!run2 && gridFactor && manager) {
    [run2] = await db.insert(s.calculationRuns).values({ organisationId: org.id, methodologyId: meth.id, scope: "Scope 2", period: "2026-08", status: "approved", createdBy: manager.id }).returning();
    const t = (84200 * Number(gridFactor.factorKgco2e)) / 1000;
    const [ci] = await db.insert(s.calculationInputs).values({ runId: run2.id, activityData: "84200" as never, unit: "kWh", factorId: gridFactor.id, siteId: lagos?.id ?? null, label: "Grid electricity — Lagos — Aug 2026" }).returning();
    await db.insert(s.calculationOutputs).values({ runId: run2.id, inputId: ci.id, emissionsTco2e: String(t) as never, detail: { factor: gridFactor.code, methodology: "GHG Protocol" } as never });
    await db.update(s.calculationRuns).set({ totalTco2e: String(t) as never }).where(eq(s.calculationRuns.id, run2.id));
  }

  const repExists = (await db.select().from(s.reports).where(eq(s.reports.organisationId, org.id))).some((r) => r.title.includes("FY2026"));
  if (!repExists && manager) {
    const [rep] = await db.insert(s.reports).values({ organisationId: org.id, title: "FY2026 Sustainability Report (IFRS S1/S2)", period: "2026", status: "draft", createdBy: manager.id }).returning();
    const secs = ["Governance & Strategy", "Materiality", "Climate & GHG (IFRS S2)", "Environment — Energy, Water, Waste", "Social & Workforce", "Assurance Readiness"];
    for (let i = 0; i < secs.length; i++) {
      await db.insert(s.reportSections).values({ reportId: rep.id, title: secs[i], position: i, content: "Assembled from approved data at publish time." });
    }
  }

  // Consultant assignment (multi-client access demo)
  const consultant = (await db.select().from(s.users).where(eq(s.users.email, "consultant@partner.ng")))[0];
  if (consultant) {
    await db.insert(s.consultantClients).values({ userId: consultant.id, organisationId: org.id }).onConflictDoNothing();
  }

  // Validation rules (range checks driving auto-validation on submission)
  const allMetrics = await db.select().from(s.metrics);
  const mcode = (c: string) => allMetrics.find((m) => m.code === c && m.organisationId === org.id)?.id;
  const ruleSeed: [string, Record<string, number>][] = [
    ["ELC", { min: 1000, max: 500000 }], ["DSL", { min: 100, max: 200000 }],
    ["WTR", { min: 100, max: 200000 }], ["WST", { min: 0, max: 5000 }],
  ];
  for (const [code, cfg] of ruleSeed) {
    const mid = mcode(code);
    if (!mid) continue;
    const exists = (await db.select().from(s.validationRules)).some((r) => r.metricId === mid && r.ruleType === "range");
    if (!exists) await db.insert(s.validationRules).values({ organisationId: org.id, metricId: mid, ruleType: "range", config: cfg as never, severity: "high" });
  }

  console.log("Seed complete. Demo logins: admin@greenharvest.ng / esg.manager@greenharvest.ng (password: GreenHarvest2026!)");
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
