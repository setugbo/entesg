import { db } from "@/db";

/** Plain (non-action) helper: create a notification. Never throws. */
export async function notify(orgId: string | null, userId: string | null, title: string, body?: string) {
  if (!db || !orgId) return;
  try {
    const { notifications } = await import("@/db/schema");
    await db.insert(notifications).values({ organisationId: orgId, userId, title, body });
  } catch { /* never break the request */ }
}

export async function notifyOrg(orgId: string | null, title: string, body?: string) {
  return notify(orgId, null, title, body);
}
