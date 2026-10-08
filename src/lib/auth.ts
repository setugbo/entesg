import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sessions, users, userRoles, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hasPermission, type PermissionKey } from "./permissions";

const SESSION_COOKIE = "entesg_session";
const secret = new TextEncoder().encode(
  process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-me-please-32-chars!!"
);

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  organisationId: string | null;
  roleKeys: string[];
};

export async function createSessionToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function setSessionCookie(token: string) {
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  // Demo fallback when no DB: allow UI to render with a built-in demo identity
  // if DEMO_MODE is set, otherwise null (logged out).
  if (!db) {
    return null;
  }
  try {
    const c = await cookies();
    const token = c.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.sub as string;
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const u = rows[0];
    if (!u) return null;
    const ur = await db.select({ key: roles.key }).from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(userRoles.userId, u.id));
    const roleKeys = ur.map((r) => r.key);
    // Active-organisation override for SUPER_ADMIN / assigned consultants (server-validated).
    let organisationId = u.organisationId;
    const override = c.get("entesg_org")?.value;
    if (override) {
      if (roleKeys.includes("SUPER_ADMIN")) {
        organisationId = override;
      } else {
        const { consultantClients } = await import("@/db/schema");
        const { and } = await import("drizzle-orm");
        const rows = await db.select().from(consultantClients)
          .where(and(eq(consultantClients.userId, u.id), eq(consultantClients.organisationId, override)));
        if (rows.length) organisationId = override;
      }
    }
    return {
      id: u.id, email: u.email, name: u.name,
      organisationId,
      roleKeys,
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return u;
}

export async function requirePermission(perm: PermissionKey): Promise<SessionUser> {
  const u = await requireUser();
  const isSuper = u.roleKeys.includes("SUPER_ADMIN");
  if (!isSuper && !hasPermission(u.roleKeys, perm)) redirect("/forbidden");
  return u;
}

/** Tenant guard: SUPER_ADMIN may cross orgs; everyone else is pinned to their org. */
export function assertTenant(user: SessionUser, organisationId: string | null | undefined) {
  if (user.roleKeys.includes("SUPER_ADMIN")) return;
  if (!user.organisationId || user.organisationId !== organisationId) {
    throw new Error("Tenant isolation violation: cross-organisation access denied.");
  }
}

export async function logAudit(input: {
  organisationId?: string | null; userId?: string | null;
  action: string; entity?: string; entityId?: string;
  oldValue?: unknown; newValue?: unknown;
}) {
  if (!db) return;
  try {
    await db.insert((await import("@/db/schema")).auditEvents).values({
      organisationId: input.organisationId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      oldValue: input.oldValue as never,
      newValue: input.newValue as never,
    });
  } catch { /* audit must never break the request */ }
}
