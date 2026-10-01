// QAS33 file storage (filesystem) — metadata lives in the database
import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";

const STORAGE_ROOT = path.join(process.cwd(), "db", "storage");
export const UPLOADS_DIR = path.join(STORAGE_ROOT, "uploads");
export const GENERATED_DIR = path.join(STORAGE_ROOT, "generated");

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export async function saveUploadedFile(
  buffer: Buffer,
  barangayCode: string,
  submissionId: string,
  originalName: string
): Promise<string> {
  const key = path.join("uploads", barangayCode, submissionId, `${randomBytes(8).toString("hex")}-${sanitizeFilename(originalName)}`);
  const abs = path.join(STORAGE_ROOT, key);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer);
  return key;
}

// File Library — shared uploads from ANY authenticated user (barangay or console)
// scope = barangay code (e.g. PD-BRG-006) or admin username
export async function saveSharedFile(buffer: Buffer, scope: string, originalName: string): Promise<string> {
  const key = path.join("uploads", "library", sanitizeFilename(scope), `${randomBytes(8).toString("hex")}-${sanitizeFilename(originalName)}`);
  const abs = path.join(STORAGE_ROOT, key);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer);
  return key;
}

export async function readStoredFile(storageKey: string): Promise<Buffer> {
  const abs = path.join(STORAGE_ROOT, storageKey);
  // prevent path traversal (boundary-safe: reject sibling dirs like db/storageX)
  if (!abs.startsWith(STORAGE_ROOT + path.sep)) throw new Error("Invalid storage key");
  return fs.readFile(abs);
}

export async function deleteStoredFile(storageKey: string): Promise<void> {
  try {
    const abs = path.join(STORAGE_ROOT, storageKey);
    if (!abs.startsWith(STORAGE_ROOT + path.sep)) return;
    await fs.unlink(abs);
  } catch {
    // ignore missing files
  }
}

export async function saveGeneratedDocument(docId: string, buffer: Buffer): Promise<string> {
  const key = path.join("generated", `${docId}.pdf`);
  const abs = path.join(STORAGE_ROOT, key);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer);
  return key;
}

// Public incident report attachments (photo evidence from the Report modal)
export async function saveIncidentAttachment(referenceNo: string, buffer: Buffer, originalName: string, ext: string): Promise<string> {
  const safeRef = referenceNo.replace(/[^a-zA-Z0-9-]/g, "");
  const key = path.join("incidents", safeRef, `${randomBytes(6).toString("hex")}-${sanitizeFilename(originalName).slice(0, 60)}.${ext}`);
  const abs = path.join(STORAGE_ROOT, key);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer);
  return key;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
