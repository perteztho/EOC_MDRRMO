import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClientIp, resolveSession } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { readStoredFile } from "@/lib/qas33/storage";

// GET — download / preview a File Library item (ANY authenticated user)
// Barangay sessions can only download their own barangay's files; console users can download any.
export async function GET(request: NextRequest) {
  const resolved = await resolveSession();
  if (!resolved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const row = await db.storedFile.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "File not found." }, { status: 404 });

  if (resolved.session.role === "BARANGAY") {
    if (!resolved.barangay || row.ownerType !== "BARANGAY" || row.barangayId !== resolved.barangay.id) {
      return NextResponse.json({ error: "You can only access your own barangay's files." }, { status: 403 });
    }
  } else if (resolved.session.role !== "ADMIN" || !resolved.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let buffer: Buffer;
  try {
    buffer = await readStoredFile(row.storageKey);
  } catch {
    return NextResponse.json({ error: "The stored file is missing on the server." }, { status: 410 });
  }

  await db.storedFile.update({ where: { id: row.id }, data: { downloads: { increment: 1 } } }).catch(() => undefined);
  await logAudit({
    actorType: resolved.session.role === "BARANGAY" ? "BARANGAY" : "ADMIN",
    actorName: resolved.session.role === "BARANGAY" && resolved.barangay ? `Barangay ${resolved.barangay.name}` : resolved.admin!.name,
    action: "FILE_DOWNLOADED",
    detail: `File Library download: ${row.originalName}`,
    barangayId: row.barangayId,
    ip: getClientIp(request),
  }).catch(() => undefined);

  const inline = row.kind === "IMAGE" || row.mimeType === "application/pdf";
  const asciiName = row.originalName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": row.mimeType || "application/octet-stream",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiName}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
