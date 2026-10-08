// entESG — permission catalogue + role matrix (server-enforced).
export const PERMISSIONS = [
  "assessment.view", "assessment.create", "assessment.edit", "assessment.submit", "assessment.review", "assessment.approve",
  "metric.view", "metric.create", "metric.edit", "metric.submit", "metric.approve",
  "evidence.view", "evidence.upload", "evidence.review", "evidence.approve",
  "requirement.view", "requirement.manage",
  "control.view", "control.manage", "control.test",
  "report.view", "report.create", "report.edit", "report.approve", "report.export",
  "user.view", "user.manage",
  "audit.view",
  "risk.view", "risk.manage",
  "target.view", "target.manage",
  "ghg.view", "ghg.calculate", "ghg.approve",
  "materiality.view", "materiality.manage",
  "admin.manage",
] as const;
export type PermissionKey = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  SUPER_ADMIN: [...PERMISSIONS],
  ORGANISATION_ADMIN: [
    "assessment.view","assessment.create","assessment.edit","assessment.submit","assessment.review","assessment.approve",
    "metric.view","metric.create","metric.edit","metric.submit","metric.approve",
    "evidence.view","evidence.upload","evidence.review","evidence.approve",
    "requirement.view","requirement.manage",
    "control.view","control.manage","control.test",
    "report.view","report.create","report.edit","report.approve","report.export",
    "user.view","user.manage","audit.view",
    "risk.view","risk.manage","target.view","target.manage",
    "ghg.view","ghg.calculate","ghg.approve","materiality.view","materiality.manage",
  ],
  ESG_MANAGER: [
    "assessment.view","assessment.create","assessment.edit","assessment.submit","assessment.review",
    "metric.view","metric.create","metric.edit","metric.submit",
    "evidence.view","evidence.upload","evidence.review",
    "requirement.view","requirement.manage",
    "control.view","control.manage","control.test",
    "report.view","report.create","report.edit","report.export",
    "risk.view","risk.manage","target.view","target.manage",
    "ghg.view","ghg.calculate","materiality.view","materiality.manage",
  ],
  ESG_ANALYST: ["assessment.view","assessment.edit","metric.view","metric.create","metric.edit","metric.submit","evidence.view","evidence.upload","requirement.view","control.view","report.view","report.create","risk.view","target.view","ghg.view","ghg.calculate","materiality.view"],
  DATA_OWNER: ["assessment.view","metric.view","metric.submit","evidence.view","evidence.upload","report.view","ghg.view"],
  CONTRIBUTOR: ["assessment.view","metric.view","metric.submit","evidence.view","evidence.upload"],
  REVIEWER: ["assessment.view","assessment.review","metric.view","evidence.view","evidence.review","report.view","control.view","control.test","ghg.view","materiality.view"],
  APPROVER: ["assessment.view","assessment.approve","metric.view","metric.approve","evidence.view","evidence.approve","report.view","report.approve","control.view","ghg.view","ghg.approve"],
  AUDITOR: ["assessment.view","metric.view","evidence.view","requirement.view","control.view","report.view","report.export","audit.view","risk.view","ghg.view","materiality.view"],
  CONSULTANT: ["assessment.view","assessment.create","assessment.edit","metric.view","metric.create","evidence.view","evidence.upload","requirement.view","control.view","report.view","report.create","risk.view","target.view","ghg.view","materiality.view"],
  EXECUTIVE: ["assessment.view","metric.view","evidence.view","requirement.view","control.view","report.view","report.export","risk.view","target.view","ghg.view","materiality.view"],
};

export const ROLES = Object.keys(ROLE_PERMISSIONS);

export function hasPermission(roleKeys: string[], perm: PermissionKey): boolean {
  return roleKeys.some((r) => ROLE_PERMISSIONS[r]?.includes(perm));
}
