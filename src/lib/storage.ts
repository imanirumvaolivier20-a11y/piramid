import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// Files live on local disk for now. Everything goes through this module, so
// moving to MinIO/S3 later only means reimplementing saveImage and readStored.

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const CONTENT_TYPES = Object.fromEntries(Object.entries(EXTENSIONS).map(([type, ext]) => [ext, type]));

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const KEY_PATTERN = /^(reports|receipts|logos)\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

/** Returns a message if the file is not an acceptable image, otherwise null. */
export function imageProblem(file: File): string | null {
  if (!EXTENSIONS[file.type]) return "Photos must be JPEG, PNG or WebP images.";
  if (file.size > MAX_IMAGE_BYTES) return "Each photo must be smaller than 8 MB.";
  return null;
}

export async function saveImage(file: File, folder: "reports" | "receipts" | "logos") {
  const key = `${folder}/${randomUUID()}.${EXTENSIONS[file.type]}`;
  const target = path.join(UPLOAD_DIR, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await file.arrayBuffer()));
  return { key, contentType: file.type, size: file.size };
}

export async function deleteStored(key: string) {
  if (!KEY_PATTERN.test(key)) return;
  await rm(path.join(UPLOAD_DIR, key), { force: true });
}

export async function readStored(key: string) {
  if (!KEY_PATTERN.test(key)) return null;
  try {
    const data = await readFile(path.join(UPLOAD_DIR, key));
    return { data, contentType: CONTENT_TYPES[key.split(".").pop()!] };
  } catch {
    return null;
  }
}
