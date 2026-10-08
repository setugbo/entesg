import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";

export async function hash(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived: Buffer = await new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key as Buffer)));
  });
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function compare(password: string, stored: string): Promise<boolean> {
  try {
    if (stored.startsWith("$2")) {
      // bcrypt hash (seeded via bcryptjs) — compare with bcryptjs if available
      const { compareSync } = await import("bcryptjs").catch(() => ({ compareSync: null }));
      if (compareSync) return compareSync(password, stored);
      return false;
    }
    const [, salt, hex] = stored.split(":");
    const derived: Buffer = await new Promise((resolve, reject) => {
      scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key as Buffer)));
    });
    const a = Buffer.from(hex, "hex");
    return a.length === derived.length && timingSafeEqual(a, derived);
  } catch {
    return false;
  }
}
