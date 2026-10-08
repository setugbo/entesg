// entESG — complete PostgreSQL schema (Drizzle ORM)
// Portable: plain PostgreSQL, no Neon-proprietary features. UUIDs, FKs, indexes, timestamps.
import {
  pgTable, uuid, text, varchar, integer, numeric, boolean, timestamp,
  date, jsonb, pgEnum, index, uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------- Enums ----------
export const userStatusEnum = pgEnum("user_status", ["active", "invited", "suspended"]);
export const assessmentStatusEnum = pgEnum("assessment_status", ["draft", "in_progress", "submitted", "under_review", "returned", "approved"]);
export const questionTypeEnum = pgEnum("question_type", ["yes_no","single_choice","multiple_choice","text","long_text","number","percentage","currency","date","select","multi_select","rating","metric","evidence_required","file_upload"]);
export const dataRequestStatusEnum = pgEnum("data_request_status", ["draft","sent","in_progress","submitted","returned","validated","approved","overdue"]);
export const evidenceStatusEnum = pgEnum("evidence_status", ["uploaded","under_review","accepted","rejected","expired","superseded"]);
export const metricValueStatusEnum = pgEnum("metric_value_status", ["draft","submitted","validated","approved","rejected"]);
export const calcStatusEnum = pgEnum("calc_status", ["draft","review","approved"]);
export const controlTestResultEnum = pgEnum("control_test_result", ["effective","partially_effective","ineffective","not_tested"]);
export const reportStatusEnum = pgEnum("report_status", ["draft","review","approval","published"]);
export const taskStatusEnum = pgEnum("task_status", ["open","in_progress","blocked","done","cancelled"]);
export const approvalDecisionEnum = pgEnum("approval_decision", ["approved","rejected","returned"]);
export const severityEnum = pgEnum("severity", ["critical","high","medium","low","on_track"]);

// ---------- Core tenancy ----------
export const organisations = pgTable("organisations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull(),
  country: varchar("country", { length: 64 }).default("Nigeria"),
  jurisdiction: varchar("jurisdiction", { length: 64 }).default("Nigeria"),
  industry: varchar("industry", { length: 128 }).default("FMCG / Manufacturing"),
  sector: varchar("sector", { length: 128 }),
  orgType: varchar("org_type", { length: 64 }).default("private"),
  sizeBand: varchar("size_band", { length: 64 }),
  listed: boolean("listed").default(false),
  reportingFrameworks: jsonb("reporting_frameworks").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("org_slug_uidx").on(t.slug)]);

export const organisationSettings = pgTable("organisation_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  fiscalYearStart: varchar("fiscal_year_start", { length: 8 }).default("01-01"),
  baseYear: integer("base_year").default(2023),
  currency: varchar("currency", { length: 8 }).default("NGN"),
  internalCarbonPrice: numeric("internal_carbon_price", { precision: 14, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const businessEntities = pgTable("business_entities", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("be_org_idx").on(t.organisationId)]);

export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  entityId: uuid("entity_id").references(() => businessEntities.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 128 }),
  country: varchar("country", { length: 64 }).default("Nigeria"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("sites_org_idx").on(t.organisationId)]);

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("dept_org_idx").on(t.organisationId)]);

// ---------- Users / RBAC (Better Auth compatible + app roles) ----------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: boolean("email_verified").default(false),
  image: text("image"),
  passwordHash: text("password_hash"),
  status: userStatusEnum("status").default("active").notNull(),
  organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "set null" }),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("users_email_uidx").on(t.email), index("users_org_idx").on(t.organisationId)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("sessions_token_uidx").on(t.token), index("sessions_user_idx").on(t.userId)]);

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  system: boolean("system").default(true),
}, (t) => [uniqueIndex("roles_key_uidx").on(t.key)]);

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 128 }).notNull(),
  description: text("description"),
}, (t) => [uniqueIndex("perm_key_uidx").on(t.key)]);

export const rolePermissions = pgTable("role_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
});

export const userRoles = pgTable("user_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "cascade" }),
});

export const consultantClients = pgTable("consultant_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Regulatory engine ----------
export const frameworks = pgTable("frameworks", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  publisher: varchar("publisher", { length: 255 }),
  description: text("description"),
}, (t) => [uniqueIndex("fw_code_uidx").on(t.code)]);

export const frameworkVersions = pgTable("framework_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  frameworkId: uuid("framework_id").notNull().references(() => frameworks.id, { onDelete: "cascade" }),
  version: varchar("version", { length: 64 }).notNull(),
  effectiveDate: date("effective_date"),
  jurisdiction: varchar("jurisdiction", { length: 64 }),
  sourceUrl: text("source_url"),
  status: varchar("status", { length: 32 }).default("active"),
});

export const requirements = pgTable("requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  frameworkVersionId: uuid("framework_version_id").references(() => frameworkVersions.id, { onDelete: "set null" }),
  code: varchar("code", { length: 128 }).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  topic: varchar("topic", { length: 128 }),
  category: varchar("category", { length: 64 }),
  jurisdiction: varchar("jurisdiction", { length: 64 }),
  sector: varchar("sector", { length: 128 }),
  applicability: jsonb("applicability").$type<Record<string, unknown>>().default({}),
  sourceOrg: varchar("source_org", { length: 255 }),
  sourceDoc: varchar("source_doc", { length: 512 }),
  sourceUrl: text("source_url"),
  version: varchar("version", { length: 64 }),
  effectiveDate: date("effective_date"),
  reviewDate: date("review_date"),
  reviewer: varchar("reviewer", { length: 255 }),
  interpretation: text("interpretation"),
  validationStatus: varchar("validation_status", { length: 64 }).default("REQUIRES SME VALIDATION"),
  criticality: severityEnum("criticality").default("medium"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("req_fw_idx").on(t.frameworkVersionId), index("req_topic_idx").on(t.topic), uniqueIndex("req_fw_code_uidx").on(t.frameworkVersionId, t.code)]);

export const disclosures = pgTable("disclosures", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "cascade" }),
  requirementId: uuid("requirement_id").references(() => requirements.id, { onDelete: "set null" }),
  title: varchar("title", { length: 512 }).notNull(),
  status: varchar("status", { length: 32 }).default("draft"),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("disc_org_idx").on(t.organisationId)]);

export const disclosureRequirements = pgTable("disclosure_requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  disclosureId: uuid("disclosure_id").notNull().references(() => disclosures.id, { onDelete: "cascade" }),
  requirementId: uuid("requirement_id").notNull().references(() => requirements.id, { onDelete: "cascade" }),
});

export const requirementMappings = pgTable("requirement_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromRequirementId: uuid("from_requirement_id").notNull().references(() => requirements.id, { onDelete: "cascade" }),
  toRequirementId: uuid("to_requirement_id").notNull().references(() => requirements.id, { onDelete: "cascade" }),
  relation: varchar("relation", { length: 64 }).default("maps_to"),
});

// ---------- Questionnaires / assessments ----------
export const questionnaires = pgTable("questionnaires", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  frameworkVersionId: uuid("framework_version_id").references(() => frameworkVersions.id, { onDelete: "set null" }),
  status: varchar("status", { length: 32 }).default("active"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const questionnaireSections = pgTable("questionnaire_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionnaireId: uuid("questionnaire_id").notNull().references(() => questionnaires.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 512 }).notNull(),
  position: integer("position").default(0),
});

export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sectionId: uuid("section_id").notNull().references(() => questionnaireSections.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 64 }).notNull(),
  text: text("text").notNull(),
  type: questionTypeEnum("type").default("yes_no").notNull(),
  guidance: text("guidance"),
  weight: numeric("weight", { precision: 6, scale: 2 }).default("1"),
  requiredEvidence: boolean("required_evidence").default(false),
  applicability: jsonb("applicability").$type<Record<string, unknown>>().default({}),
  ownerRole: varchar("owner_role", { length: 64 }),
  requirementId: uuid("requirement_id").references(() => requirements.id, { onDelete: "set null" }),
  position: integer("position").default(0),
});

export const questionOptions = pgTable("question_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 512 }).notNull(),
  value: varchar("value", { length: 255 }).notNull(),
  score: numeric("score", { precision: 6, scale: 2 }).default("0"),
  position: integer("position").default(0),
});

export const questionMappings = pgTable("question_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  requirementId: uuid("requirement_id").notNull().references(() => requirements.id, { onDelete: "cascade" }),
});

export const assessments = pgTable("assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  questionnaireId: uuid("questionnaire_id").notNull().references(() => questionnaires.id),
  title: varchar("title", { length: 512 }).notNull(),
  status: assessmentStatusEnum("status").default("draft").notNull(),
  score: numeric("score", { precision: 6, scale: 2 }),
  readinessBand: varchar("readiness_band", { length: 32 }),
  hasCriticalGap: boolean("has_critical_gap").default(false),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  reviewerId: uuid("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  approverId: uuid("approver_id").references(() => users.id, { onDelete: "set null" }),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("assess_org_idx").on(t.organisationId)]);

export const assessmentAnswers = pgTable("assessment_answers", {
  id: uuid("id").primaryKey().defaultRandom(),
  assessmentId: uuid("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").notNull().references(() => questions.id),
  value: jsonb("value"),
  score: numeric("score", { precision: 6, scale: 2 }),
  comment: text("comment"),
  answeredBy: uuid("answered_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("ans_assess_idx").on(t.assessmentId)]);

export const assessmentScores = pgTable("assessment_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  assessmentId: uuid("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  dimension: varchar("dimension", { length: 64 }).notNull(),
  score: numeric("score", { precision: 6, scale: 2 }).notNull(),
  status: severityEnum("status").default("medium"),
  computedAt: timestamp("computed_at").defaultNow().notNull(),
});

// ---------- Metrics / data engine ----------
export const metricCategories = pgTable("metric_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  pillar: varchar("pillar", { length: 32 }),
});

export const metricUnits = pgTable("metric_units", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 32 }).notNull(),
  label: varchar("label", { length: 128 }).notNull(),
});

export const metrics = pgTable("metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 64 }).notNull(),
  name: varchar("name", { length: 512 }).notNull(),
  categoryId: uuid("category_id").references(() => metricCategories.id, { onDelete: "set null" }),
  description: text("description"),
  unitId: uuid("unit_id").references(() => metricUnits.id, { onDelete: "set null" }),
  frequency: varchar("frequency", { length: 32 }).default("monthly"),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  source: varchar("source", { length: 255 }),
  methodology: text("methodology"),
  isGlobal: boolean("is_global").default(false),
}, (t) => [index("metrics_org_idx").on(t.organisationId)]);

export const metricValues = pgTable("metric_values", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  metricId: uuid("metric_id").notNull().references(() => metrics.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").references(() => sites.id, { onDelete: "set null" }),
  entityId: uuid("entity_id").references(() => businessEntities.id, { onDelete: "set null" }),
  period: varchar("period", { length: 16 }).notNull(),
  value: numeric("value", { precision: 20, scale: 4 }).notNull(),
  status: metricValueStatusEnum("status").default("draft").notNull(),
  submittedBy: uuid("submitted_by").references(() => users.id, { onDelete: "set null" }),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("mv_org_metric_period_idx").on(t.organisationId, t.metricId, t.period)]);

export const metricTargets = pgTable("metric_targets", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  metricId: uuid("metric_id").notNull().references(() => metrics.id, { onDelete: "cascade" }),
  baselineYear: integer("baseline_year"),
  baselineValue: numeric("baseline_value", { precision: 20, scale: 4 }),
  targetYear: integer("target_year"),
  targetValue: numeric("target_value", { precision: 20, scale: 4 }),
});

export const metricBaselines = pgTable("metric_baselines", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  metricId: uuid("metric_id").notNull().references(() => metrics.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  value: numeric("value", { precision: 20, scale: 4 }).notNull(),
});

export const metricComparatives = pgTable("metric_comparatives", {
  id: uuid("id").primaryKey().defaultRandom(),
  metricValueId: uuid("metric_value_id").notNull().references(() => metricValues.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 128 }).notNull(),
  value: numeric("value", { precision: 20, scale: 4 }).notNull(),
});

// ---------- Data requests ----------
export const dataRequests = pgTable("data_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  reviewerId: uuid("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  siteId: uuid("site_id").references(() => sites.id, { onDelete: "set null" }),
  entityId: uuid("entity_id").references(() => businessEntities.id, { onDelete: "set null" }),
  period: varchar("period", { length: 16 }),
  dueDate: date("due_date"),
  priority: varchar("priority", { length: 16 }).default("medium"),
  status: dataRequestStatusEnum("status").default("draft").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("dr_org_idx").on(t.organisationId)]);

export const dataRequestItems = pgTable("data_request_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull().references(() => dataRequests.id, { onDelete: "cascade" }),
  metricId: uuid("metric_id").references(() => metrics.id, { onDelete: "set null" }),
  questionId: uuid("question_id").references(() => questions.id, { onDelete: "set null" }),
  label: varchar("label", { length: 512 }).notNull(),
  required: boolean("required").default(true),
});

export const dataSubmissions = pgTable("data_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull().references(() => dataRequests.id, { onDelete: "cascade" }),
  itemId: uuid("item_id").references(() => dataRequestItems.id, { onDelete: "set null" }),
  metricValueId: uuid("metric_value_id").references(() => metricValues.id, { onDelete: "set null" }),
  payload: jsonb("payload"),
  comment: text("comment"),
  submittedBy: uuid("submitted_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const validationRules = pgTable("validation_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "cascade" }),
  metricId: uuid("metric_id").references(() => metrics.id, { onDelete: "cascade" }),
  ruleType: varchar("rule_type", { length: 64 }).notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
  severity: severityEnum("severity").default("medium"),
});

export const validationResults = pgTable("validation_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  metricValueId: uuid("metric_value_id").references(() => metricValues.id, { onDelete: "cascade" }),
  ruleId: uuid("rule_id").references(() => validationRules.id, { onDelete: "set null" }),
  passed: boolean("passed").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Evidence ----------
export const evidence = pgTable("evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 512 }).notNull(),
  type: varchar("type", { length: 64 }),
  mimeType: varchar("mime_type", { length: 128 }),
  storageKey: text("storage_key").notNull(),
  sizeBytes: integer("size_bytes"),
  source: varchar("source", { length: 255 }),
  period: varchar("period", { length: 16 }),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  version: integer("version").default(1),
  status: evidenceStatusEnum("status").default("uploaded").notNull(),
  expiryDate: date("expiry_date"),
  reviewerId: uuid("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  checksum: varchar("checksum", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("ev_org_idx").on(t.organisationId)]);

export const evidenceVersions = pgTable("evidence_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  evidenceId: uuid("evidence_id").notNull().references(() => evidence.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  storageKey: text("storage_key").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const evidenceLinks = pgTable("evidence_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  evidenceId: uuid("evidence_id").notNull().references(() => evidence.id, { onDelete: "cascade" }),
  entityType: varchar("entity_type", { length: 64 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const evidenceReviews = pgTable("evidence_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  evidenceId: uuid("evidence_id").notNull().references(() => evidence.id, { onDelete: "cascade" }),
  reviewerId: uuid("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  decision: approvalDecisionEnum("decision").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- GHG ----------
export const methodologies = pgTable("methodologies", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  version: varchar("version", { length: 32 }).default("1.0"),
});

export const emissionFactorSources = pgTable("emission_factor_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  year: integer("year"),
  url: text("url"),
});

export const emissionFactors = pgTable("emission_factors", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 128 }).notNull(),
  fuel: varchar("fuel", { length: 128 }).notNull(),
  unit: varchar("unit", { length: 32 }).notNull(),
  scope: varchar("scope", { length: 16 }).notNull(),
  factorKgco2e: numeric("factor_kgco2e", { precision: 18, scale: 6 }).notNull(),
  sourceId: uuid("source_id").references(() => emissionFactorSources.id, { onDelete: "set null" }),
  version: varchar("version", { length: 32 }).default("1.0"),
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
});

export const calculationRuns = pgTable("calculation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  methodologyId: uuid("methodology_id").references(() => methodologies.id, { onDelete: "set null" }),
  scope: varchar("scope", { length: 16 }).notNull(),
  period: varchar("period", { length: 16 }).notNull(),
  status: calcStatusEnum("status").default("draft").notNull(),
  totalTco2e: numeric("total_tco2e", { precision: 20, scale: 4 }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("calc_org_idx").on(t.organisationId)]);

export const calculationInputs = pgTable("calculation_inputs", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => calculationRuns.id, { onDelete: "cascade" }),
  metricValueId: uuid("metric_value_id").references(() => metricValues.id, { onDelete: "set null" }),
  activityData: numeric("activity_data", { precision: 20, scale: 4 }).notNull(),
  unit: varchar("unit", { length: 32 }).notNull(),
  factorId: uuid("factor_id").references(() => emissionFactors.id, { onDelete: "set null" }),
  siteId: uuid("site_id").references(() => sites.id, { onDelete: "set null" }),
  label: varchar("label", { length: 512 }),
});

export const calculationOutputs = pgTable("calculation_outputs", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").notNull().references(() => calculationRuns.id, { onDelete: "cascade" }),
  inputId: uuid("input_id").references(() => calculationInputs.id, { onDelete: "cascade" }),
  emissionsTco2e: numeric("emissions_tco2e", { precision: 20, scale: 4 }).notNull(),
  detail: jsonb("detail").$type<Record<string, unknown>>().default({}),
});

// ---------- Materiality ----------
export const materialityAssessments = pgTable("materiality_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 512 }).notNull(),
  year: integer("year").notNull(),
  status: varchar("status", { length: 32 }).default("draft"),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const materialityTopics = pgTable("materiality_topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  assessmentId: uuid("assessment_id").notNull().references(() => materialityAssessments.id, { onDelete: "cascade" }),
  topic: varchar("topic", { length: 255 }).notNull(),
  category: varchar("category", { length: 64 }),
  impactScore: integer("impact_score"),
  financialScore: integer("financial_score"),
  combinedScore: numeric("combined_score", { precision: 5, scale: 2 }),
  decision: varchar("decision", { length: 32 }),
  rationale: text("rationale"),
  evidence: text("evidence"),
  stakeholderConcern: text("stakeholder_concern"),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
});

export const materialityScores = pgTable("materiality_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  topicId: uuid("topic_id").notNull().references(() => materialityTopics.id, { onDelete: "cascade" }),
  scorerId: uuid("scorer_id").references(() => users.id, { onDelete: "set null" }),
  impactScore: integer("impact_score"),
  financialScore: integer("financial_score"),
  comment: text("comment"),
});

export const stakeholders = pgTable("stakeholders", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  group: varchar("group", { length: 128 }),
});

export const stakeholderEngagement = pgTable("stakeholder_engagement", {
  id: uuid("id").primaryKey().defaultRandom(),
  assessmentId: uuid("assessment_id").notNull().references(() => materialityAssessments.id, { onDelete: "cascade" }),
  stakeholderId: uuid("stakeholder_id").references(() => stakeholders.id, { onDelete: "set null" }),
  method: varchar("method", { length: 128 }),
  summary: text("summary"),
  date: date("date"),
});

// ---------- Risks / opportunities / controls ----------
export const risks = pgTable("risks", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 64 }),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("risks_org_idx").on(t.organisationId)]);

export const opportunities = pgTable("opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 64 }),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const riskAssessments = pgTable("risk_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  riskId: uuid("risk_id").notNull().references(() => risks.id, { onDelete: "cascade" }),
  likelihood: integer("likelihood"),
  impact: integer("impact"),
  inherentRisk: integer("inherent_risk"),
  controlEffectiveness: integer("control_effectiveness"),
  residualRisk: integer("residual_risk"),
  assessedBy: uuid("assessed_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const riskTreatments = pgTable("risk_treatments", {
  id: uuid("id").primaryKey().defaultRandom(),
  riskId: uuid("risk_id").notNull().references(() => risks.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  dueDate: date("due_date"),
  status: taskStatusEnum("status").default("open"),
});

export const controls = pgTable("controls", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 64 }).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  frequency: varchar("frequency", { length: 32 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("controls_org_idx").on(t.organisationId)]);

export const controlTests = pgTable("control_tests", {
  id: uuid("id").primaryKey().defaultRandom(),
  controlId: uuid("control_id").notNull().references(() => controls.id, { onDelete: "cascade" }),
  testerId: uuid("tester_id").references(() => users.id, { onDelete: "set null" }),
  result: controlTestResultEnum("result").default("not_tested").notNull(),
  notes: text("notes"),
  testedAt: timestamp("tested_at").defaultNow(),
});

export const controlEvidence = pgTable("control_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  controlId: uuid("control_id").notNull().references(() => controls.id, { onDelete: "cascade" }),
  evidenceId: uuid("evidence_id").notNull().references(() => evidence.id, { onDelete: "cascade" }),
});

export const controlExceptions = pgTable("control_exceptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  controlId: uuid("control_id").notNull().references(() => controls.id, { onDelete: "cascade" }),
  testId: uuid("test_id").references(() => controlTests.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  severity: severityEnum("severity").default("medium"),
  status: varchar("status", { length: 32 }).default("open"),
});

export const remediations = pgTable("remediations", {
  id: uuid("id").primaryKey().defaultRandom(),
  exceptionId: uuid("exception_id").notNull().references(() => controlExceptions.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  dueDate: date("due_date"),
  status: taskStatusEnum("status").default("open"),
});

// ---------- Targets / initiatives / capex ----------
export const targets = pgTable("targets", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  metricId: uuid("metric_id").references(() => metrics.id, { onDelete: "set null" }),
  title: varchar("title", { length: 512 }).notNull(),
  kind: varchar("kind", { length: 64 }),
  baselineYear: integer("baseline_year"),
  baselineValue: numeric("baseline_value", { precision: 20, scale: 4 }),
  targetYear: integer("target_year"),
  targetValue: numeric("target_value", { precision: 20, scale: 4 }),
  currentValue: numeric("current_value", { precision: 20, scale: 4 }),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  status: varchar("status", { length: 32 }).default("on_track"),
});

export const initiatives = pgTable("initiatives", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  targetId: uuid("target_id").references(() => targets.id, { onDelete: "set null" }),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  annualReductionTco2e: numeric("annual_reduction_tco2e", { precision: 20, scale: 4 }),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  status: varchar("status", { length: 32 }).default("planned"),
});

export const capexProgrammes = pgTable("capex_programmes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 512 }).notNull(),
  year: integer("year"),
});

export const capexItems = pgTable("capex_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  programmeId: uuid("programme_id").notNull().references(() => capexProgrammes.id, { onDelete: "cascade" }),
  asset: varchar("asset", { length: 512 }).notNull(),
  investment: numeric("investment", { precision: 20, scale: 2 }),
  assetLife: integer("asset_life"),
  emissionsImpact: numeric("emissions_impact", { precision: 20, scale: 4 }),
  annualReduction: numeric("annual_reduction", { precision: 20, scale: 4 }),
  netZeroCompatible: boolean("net_zero_compatible").default(false),
  alignmentGap: text("alignment_gap"),
  recommendedAction: text("recommended_action"),
});

// ---------- Workflow ----------
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
  dueDate: date("due_date"),
  status: taskStatusEnum("status").default("open").notNull(),
  entityType: varchar("entity_type", { length: 64 }),
  entityId: uuid("entity_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("tasks_org_idx").on(t.organisationId)]);

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  entityType: varchar("entity_type", { length: 64 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
  decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
  decision: approvalDecisionEnum("decision"),
  comment: text("comment"),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  entityType: varchar("entity_type", { length: 64 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 512 }).notNull(),
  body: text("body"),
  read: boolean("read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const escalations = pgTable("escalations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  entityType: varchar("entity_type", { length: 64 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  reason: text("reason").notNull(),
  escalatedTo: uuid("escalated_to").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Reports ----------
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 512 }).notNull(),
  frameworkVersionId: uuid("framework_version_id").references(() => frameworkVersions.id, { onDelete: "set null" }),
  period: varchar("period", { length: 16 }),
  status: reportStatusEnum("status").default("draft").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("reports_org_idx").on(t.organisationId)]);

export const reportSections = pgTable("report_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id").notNull().references(() => reports.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 512 }).notNull(),
  position: integer("position").default(0),
  content: text("content"),
  disclosureId: uuid("disclosure_id").references(() => disclosures.id, { onDelete: "set null" }),
});

export const reportVersions = pgTable("report_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id").notNull().references(() => reports.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  snapshot: jsonb("snapshot"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reportDataLinks = pgTable("report_data_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id").notNull().references(() => reports.id, { onDelete: "cascade" }),
  sectionId: uuid("section_id").references(() => reportSections.id, { onDelete: "cascade" }),
  entityType: varchar("entity_type", { length: 64 }).notNull(),
  entityId: uuid("entity_id").notNull(),
});

// ---------- Audit ----------
export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "set null" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 128 }).notNull(),
  entity: varchar("entity", { length: 128 }),
  entityId: varchar("entity_id", { length: 128 }),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("audit_org_idx").on(t.organisationId), index("audit_entity_idx").on(t.entity, t.entityId)]);
