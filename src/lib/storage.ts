import { createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

const hasS3 = Boolean(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID);

async function s3() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
    forcePathStyle: true,
  });
}

/** Private file storage: S3-compatible (R2) when configured, local ./uploads otherwise. */
export async function putObject(key: string, body: Buffer, contentType: string) {
  if (hasS3) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await s3();
    await client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key, Body: body, ContentType: contentType }));
    return key;
  }
  const root = path.join(process.cwd(), "uploads");
  await fs.mkdir(root, { recursive: true });
  const full = path.join(root, key.replace(/\.\./g, "_"));
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body);
  return key;
}

export async function getObject(key: string): Promise<{ body: Buffer; contentType: string } | null> {
  if (hasS3) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await s3();
    try {
      const out = await client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }));
      const chunks: Buffer[] = [];
      const stream = out.Body as unknown as AsyncIterable<Uint8Array>;
      for await (const c of stream) chunks.push(Buffer.from(c));
      return { body: Buffer.concat(chunks), contentType: (out.ContentType as string) ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }
  try {
    const full = path.join(process.cwd(), "uploads", key.replace(/\.\./g, "_"));
    const body = await fs.readFile(full);
    return { body, contentType: "application/octet-stream" };
  } catch {
    return null;
  }
}

/** Short-lived signed download URL (S3) — local mode returns the private API route instead. */
export async function signedDownloadUrl(key: string, evidenceId: string, seconds = 900): Promise<string> {
  if (hasS3) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = await s3();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }), { expiresIn: seconds });
  }
  return `/api/evidence/${evidenceId}/download`;
}

export function newStorageKey(orgId: string, filename: string) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return `${orgId}/${new Date().getFullYear()}/${randomUUID()}-${safe}`;
}

export function streamToBuffer(stream: ReadableStream<Uint8Array> | Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const s = stream as Readable;
    s.on("data", (c) => chunks.push(Buffer.from(c)));
    s.on("end", () => resolve(Buffer.concat(chunks)));
    s.on("error", reject);
  });
}

export async function ensureUploadsDir() {
  try {
    await fs.mkdir(path.join(process.cwd(), "uploads"), { recursive: true });
    // Prevent accidental static serving assumptions: deny directory listing via marker.
    await fs.writeFile(path.join(process.cwd(), "uploads", ".gitkeep"), "", { flag: "a" }).catch(() => {});
  } catch { /* ignore */ }
}
