import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBarangay, getClientIp } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { getOrCreateSubmission, getSubmissionFiles, parseValues } from "@/lib/qas33/barangay-service";
import { readStoredFile } from "@/lib/qas33/storage";
import { getSectionDefs } from "@/lib/qas33/template";

// GET — final document info (?download=1 streams the PDF and logs the download)
export async function GET(request: NextRequest) {
  const resolved = await requireBarangay();
  if (!resolved || !resolved.barangay) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const submission = await getOrCreateSubmission(resolved.barangay.id);
  const doc = await db.generatedDocument.findFirst({
    where: { submissionId: submission.id },
    orderBy: { generatedAt: "desc" },
    include: { downloads: true },
  });

  if (!doc) {
    return NextResponse.json({ error: "No final document available yet." }, { status: 404 });
  }
  if (!["READY_FOR_DOWNLOAD", "DOWNLOADED", "ARCHIVED"].includes(submission.status)) {
    return NextResponse.json({ error: "Download is locked until MDRRMO approval." }, { status: 403 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("download") === "1") {
    try {
      const buffer = await readStoredFile(doc.fileKey);
      const ip = getClientIp(request);
      const firstDownload = doc.downloads.length === 0;

      await db.downloadLog.create({
        data: {
          documentId: doc.id,
          downloadedBy: `Barangay ${resolved.barangay.name}`,
          ip,
        },
      });
      if (firstDownload && submission.status === "READY_FOR_DOWNLOAD") {
        await db.submission.update({
          where: { id: submission.id },
          data: { status: "DOWNLOADED", downloadedAt: new Date() },
        });
      }
      await logAudit({
        actorType: "BARANGAY",
        actorName: `Barangay ${resolved.barangay.name}`,
        action: "DOWNLOADED_FINAL_DOCUMENT",
        detail: `Downloaded final document ${doc.docId} (v${doc.version}) from ${ip}`,
        barangayId: resolved.barangay.id,
        ip,
      });

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${doc.docId}.pdf"`,
          "Content-Length": String(buffer.length),
        },
      });
    } catch (e) {
      console.error("download error", e);
      return NextResponse.json({ error: "File not found on server." }, { status: 500 });
    }
  }

  const downloadLogs = await db.downloadLog.findMany({
    where: { documentId: doc.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    document: {
      docId: doc.docId,
      version: doc.version,
      lang: doc.lang,
      signed: doc.signed,
      signedBy: doc.signedBy,
      signedAt: doc.signedAt?.toISOString() ?? null,
      signatureHash: doc.signatureHash,
      generatedAt: doc.generatedAt.toISOString(),
      downloadCount: downloadLogs.length,
      downloads: downloadLogs.map((d) => ({
        id: d.id,
        downloadedBy: d.downloadedBy,
        ip: d.ip,
        createdAt: d.createdAt.toISOString(),
      })),
    },
    submission: {
      status: submission.status,
      approvedAt: submission.approvedAt?.toISOString() ?? null,
    },
  });
}
