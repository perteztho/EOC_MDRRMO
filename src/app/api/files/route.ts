import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSystemAdmin, normalizeAdminRole, getClientIp, resolveSession } from "@/lib/qas33/auth";
import { logAudit } from "@/lib/qas33/audit";
import { saveSharedFile, deleteStoredFile } from "@/lib/qas33/storage";
import { getSettings } from "@/lib/qas33/server";
import { FILE_CATEGORIES, type FileLibraryItem, type FileLibraryStats } from "@/lib/qas33/types";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

// ---- helpers -------------------------------------------------------------

function toFileLibraryItem(
  row: {
    id: string;
    ownerType: string;
    ownerName: string;
    barangay: { code: string; name: string } | null;
    category: string;
    title: string | null;
    description: string | null;
    originalName: string;
    mimeType: string;
    kind: string;
    size: number;
    downloads: number;
    createdAt: Date;
    adminId: string | null;
    barangayId: string | null;
  },
  viewer: { type: "BARANGAY" | "ADMIN"; barangayId?: string; adminId?: string; sysAdmin?: boolean }
): FileLibraryItem {
  const isOwner =
    (viewer.type === "BARANGAY" && row.ownerType === "BARANGAY" && row.barangayId === viewer.barangayId) ||
    (viewer.type === "ADMIN" && row.ownerType === "ADMIN" && row.adminId === viewer.adminId);
  return {
    id: row.id,
    ownerType: row.ownerType === "BARANGAY" ? "BARANGAY" : "ADMIN",
    ownerName: row.ownerName,
    barangay: row.barangay ? { code: row.barangay.code, name: row.barangay.name } : null,
    category: row.category,
    title: row.title,
    description: row.description,
    originalName: row.originalName,
    mimeType: row.mimeType,
    kind: row.kind === "IMAGE" ? "IMAGE" : "DOCUMENT",
    size: row.size,
    downloads: row.downloads,
    createdAt: row.createdAt.toISOString(),
    canDelete: Boolean(isOwner || viewer.sysAdmin),
  };
}

async function buildStats(where: Record<string, unknown>): Promise<FileLibraryStats> {
  const [total, images, agg] = await Promise.all([
    db.storedFile.count({ where }),
    db.storedFile.count({ where: { ...where, kind: "IMAGE" } }),
    db.storedFile.aggregate({ where, _sum: { size: true } }),
  ]);
  return { total, images, documents: total - images, storageBytes: agg._sum.size ?? 0 };
}

// ---- GET — list files (ANY authenticated user) ---------------------------
// Barangay sessions always see their own barangay's files.
// Admin sessions see all files (scope=mine filters to their own uploads).
export async function GET(request: NextRequest) {
  const resolved = await resolveSession();
  if (!resolved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(48, Math.max(6, Number(url.searchParams.get("pageSize")) || 12));
  const search = (url.searchParams.get("search") || "").trim();
  const category = url.searchParams.get("category") || "ALL";
  const kind = url.searchParams.get("kind") || "ALL";

  let where: Record<string, unknown> = {};
  let viewer: { type: "BARANGAY" | "ADMIN"; barangayId?: string; adminId?: string; sysAdmin?: boolean };

  if (resolved.session.role === "BARANGAY" && resolved.barangay) {
    viewer = { type: "BARANGAY", barangayId: resolved.barangay.id };
    where = { ownerType: "BARANGAY", barangayId: resolved.barangay.id };
  } else if (resolved.session.role === "ADMIN" && resolved.admin) {
    viewer = { type: "ADMIN", adminId: resolved.admin.id, sysAdmin: isSystemAdmin(resolved.admin.role) };
    where = {};
    const scope = url.searchParams.get("scope") || "all";
    if (scope === "mine") {
      where = { ownerType: "ADMIN", adminId: resolved.admin.id };
    } else if (scope === "barangay-uploads") {
      where = { ownerType: "BARANGAY" };
    }
    const barangayCode = url.searchParams.get("barangayCode");
    if (barangayCode) {
      const brgy = await db.barangay.findUnique({ where: { code: barangayCode } });
      if (brgy) where.barangayId = brgy.id;
    }
  } else {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (category !== "ALL") where.category = category;
  if (kind === "IMAGE" || kind === "DOCUMENT") where.kind = kind;
  if (search) {
    where.OR = [
      { originalName: { contains: search } },
      { title: { contains: search } },
      { description: { contains: search } },
      { ownerName: { contains: search } },
    ];
  }

  const settings = await getSettings();

  const [rows, total, stats] = await Promise.all([
    db.storedFile.findMany({
      where,
      include: { barangay: { select: { code: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.storedFile.count({ where }),
    buildStats(where),
  ]);

  return NextResponse.json({
    files: rows.map((r) => toFileLibraryItem(r, viewer)),
    total,
    page,
    pageSize,
    stats,
    uploadConfig: { maxMB: settings.uploadMaxMB, formats: settings.uploadFormats },
  });
}

// ---- POST — upload a document or image (ANY authenticated user) ----------
export async function POST(request: NextRequest) {
  const resolved = await resolveSession();
  if (!resolved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isBarangay = resolved.session.role === "BARANGAY" && resolved.barangay;
  const isAdmin = resolved.session.role === "ADMIN" && resolved.admin;
  if (!isBarangay && !isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file") as File | null;
  const category = String(form.get("category") || "General");
  const title = String(form.get("title") || "").trim();
  const description = String(form.get("description") || "").trim();
  if (!file) return NextResponse.json({ error: "A file is required." }, { status: 400 });
  if (!FILE_CATEGORIES.includes(category as (typeof FILE_CATEGORIES)[number])) {
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  }

  const settings = await getSettings();
  const allowedExts = (settings.uploadFormats || "pdf,jpg,jpeg,png")
    .split(",")
    .map((f) => f.trim().toLowerCase())
    .filter(Boolean);
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!allowedExts.includes(ext)) {
    return NextResponse.json(
      { error: `Invalid file type ".${ext}". Accepted: ${allowedExts.join(", ").toUpperCase()}` },
      { status: 400 }
    );
  }
  const maxBytes = (settings.uploadMaxMB || 15) * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: ${settings.uploadMaxMB} MB.` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = IMAGE_EXTS.has(ext) || file.type.startsWith("image/") ? "IMAGE" : "DOCUMENT";

  let ownerType: "BARANGAY" | "ADMIN";
  let ownerName: string;
  let scope: string;
  let barangayId: string | null = null;
  let adminId: string | null = null;
  if (isBarangay) {
    ownerType = "BARANGAY";
    ownerName = `Barangay ${resolved.barangay!.name}`;
    scope = resolved.barangay!.code;
    barangayId = resolved.barangay!.id;
  } else {
    ownerType = "ADMIN";
    const roleLabel = (
      {
        SYSTEM_ADMIN: "System Administrator",
        MDRRMO_OFFICER: "MDRRMO Officer",
        MDRRMO_STAFF: "MDRRMO Staff",
      } as Record<string, string>
    )[normalizeAdminRole(resolved.admin!.role)];
    ownerName = `${resolved.admin!.name} (${roleLabel})`;
    scope = resolved.admin!.username;
    adminId = resolved.admin!.id;
  }

  const storageKey = await saveSharedFile(buffer, scope, file.name);
  const created = await db.storedFile.create({
    data: {
      ownerType,
      barangayId,
      adminId,
      ownerName,
      category,
      title: title ? title.slice(0, 160) : null,
      description: description ? description.slice(0, 500) : null,
      originalName: file.name.slice(0, 150),
      storageKey,
      mimeType: file.type || "application/octet-stream",
      kind,
      size: buffer.length,
    },
  });

  await logAudit({
    actorType: ownerType,
    actorName: ownerName,
    action: "FILE_UPLOADED",
    detail: `File Library upload: ${created.originalName} (${kind.toLowerCase()}, ${category})`,
    barangayId,
    ip: getClientIp(request),
  });

  return NextResponse.json({
    ok: true,
    file: toFileLibraryItem(
      { ...created, barangay: null },
      { type: ownerType, barangayId: created.barangayId ?? undefined, adminId: created.adminId ?? undefined, sysAdmin: true }
    ),
  });
}

// ---- DELETE — remove a file (owner or SYSTEM_ADMIN) ----------------------
export async function DELETE(request: NextRequest) {
  const resolved = await resolveSession();
  if (!resolved) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const row = await db.storedFile.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "File not found." }, { status: 404 });

  const isBarangayOwner =
    resolved.session.role === "BARANGAY" &&
    resolved.barangay &&
    row.ownerType === "BARANGAY" &&
    row.barangayId === resolved.barangay.id;
  const isAdminOwner =
    resolved.session.role === "ADMIN" && resolved.admin && row.ownerType === "ADMIN" && row.adminId === resolved.admin.id;
  const sysAdmin = resolved.session.role === "ADMIN" && resolved.admin && isSystemAdmin(resolved.admin.role);
  if (!isBarangayOwner && !isAdminOwner && !sysAdmin) {
    return NextResponse.json({ error: "You can only delete your own files." }, { status: 403 });
  }

  await db.storedFile.delete({ where: { id: row.id } });
  await deleteStoredFile(row.storageKey);
  await logAudit({
    actorType: resolved.session.role === "BARANGAY" ? "BARANGAY" : "ADMIN",
    actorName: isBarangayOwner ? `Barangay ${resolved.barangay!.name}` : resolved.admin!.name,
    action: "FILE_DELETED",
    detail: `File Library deletion: ${row.originalName}`,
    barangayId: isBarangayOwner ? resolved.barangay!.id : row.barangayId,
    ip: getClientIp(request),
  });
  return NextResponse.json({ ok: true });
}
