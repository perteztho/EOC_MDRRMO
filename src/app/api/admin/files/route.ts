import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/qas33/auth";
import { readStoredFile } from "@/lib/qas33/storage";

// GET ?fileId= — download an uploaded submission file (admin only)
export async function GET(request: NextRequest) {
  const resolved = await requireAdmin();
  if (!resolved || !resolved.admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const fileId = new URL(request.url).searchParams.get("fileId");
  if (!fileId) return NextResponse.json({ error: "fileId is required." }, { status: 400 });
  const file = await db.submissionFile.findUnique({ where: { id: fileId } });
  if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });
  try {
    const buffer = await readStoredFile(file.storageKey);
    // sanitize the client-supplied original filename (strip non-printable-ASCII
    // and quotes — Ñ/ñ become "_ — so it can never break the header)
    const asciiName = file.filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${asciiName}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing on server." }, { status: 500 });
  }
}
