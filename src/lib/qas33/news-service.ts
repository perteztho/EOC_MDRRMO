// QAS33 — News & Public Updates service.
// Rich news posts (NewsArticle) with categories, tags, galleries, attachments,
// links, audience targeting + public listing / detail with related posts.
import { db } from "@/lib/db";
import { logAudit } from "./audit";
import { NEWS_CATEGORY_SEEDS } from "./emergency-types";
import type { NewsCategoryDTO, NewsPostDTO, NewsPostInput, NewsPostStatus } from "./emergency-types";
import { htmlToPlainText, sanitizeRichText } from "./rich-text";
import type { NewsArticle, NewsCategory } from "@prisma/client";

export { sanitizeRichText };

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------

export function toNewsCategoryDTO(c: NewsCategory): NewsCategoryDTO {
  return {
    id: c.id,
    key: c.key,
    name: c.name,
    description: c.description,
    color: c.color,
    emergency: c.emergency,
    displayOrder: c.displayOrder,
    active: c.active,
  };
}

/** Build a key→row map of all news categories. */
export async function getNewsCategoryMap(): Promise<Map<string, NewsCategory>> {
  const rows = await db.newsCategory.findMany();
  return new Map(rows.map((r) => [r.key, r]));
}

function titleCaseKey(key: string): string {
  return key
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function categoryFallback(key: string): { name: string; emergency: boolean } {
  const seed = NEWS_CATEGORY_SEEDS.find((s) => s.key === key);
  if (seed) return { name: seed.name, emergency: seed.emergency };
  return { name: titleCaseKey(key || "General"), emergency: /EMERGENCY|EVACUATION|ALERT/.test(key) };
}

// ---------------------------------------------------------------------------
// DTO mapping
// ---------------------------------------------------------------------------

function safeJsonArray<T>(raw: string | null): T[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function toNewsPostDTO(
  article: NewsArticle,
  categoryMap: Map<string, NewsCategory>
): NewsPostDTO {
  const cat = categoryMap.get(article.category);
  const fallback = categoryFallback(article.category);
  const plain = htmlToPlainText(article.content, 1000);
  const excerptBase = article.summary?.trim() || plain;
  const excerpt = excerptBase.length > 220 ? `${excerptBase.slice(0, 220).trimEnd()}…` : excerptBase;
  return {
    id: article.id,
    title: article.title,
    subtitle: article.subtitle,
    summary: article.summary,
    excerpt,
    content: article.content,
    category: article.category,
    categoryName: cat?.name ?? fallback.name,
    categoryEmergency: cat ? cat.emergency : fallback.emergency,
    author: article.author,
    tags: article.tags ? article.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    featuredImage: article.featuredImage,
    gallery: safeJsonArray<string>(article.galleryJson),
    attachments: safeJsonArray<NewsPostDTO["attachments"][number]>(article.attachmentsJson),
    links: safeJsonArray<NewsPostDTO["links"][number]>(article.linksJson),
    publishAt: article.publishAt.toISOString(),
    expiresAt: article.expiresAt ? article.expiresAt.toISOString() : null,
    targetAudience: article.targetAudience,
    targetBarangays: article.targetBarangays
      ? article.targetBarangays.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    pushEnabled: article.pushEnabled,
    emergency: article.emergency,
    featured: article.featured,
    pinned: article.pinned,
    status: article.status as NewsPostStatus,
    linkUrl: article.linkUrl,
    createdByName: article.createdByName,
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export interface NewsListFilters {
  status?: string;
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  featured?: boolean;
  emergency?: boolean;
  /** public listing — published, unexpired, audience not restricted to officials */
  publicOnly?: boolean;
}

export async function listNewsPosts(
  filters: NewsListFilters
): Promise<{ posts: NewsPostDTO[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 10));
  const now = new Date();
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.category) where.category = filters.category;
  if (filters.featured !== undefined) where.featured = filters.featured;
  if (filters.emergency !== undefined) where.emergency = filters.emergency;
  const andClauses: Record<string, unknown>[] = [];
  if (filters.publicOnly) {
    where.status = "PUBLISHED";
    where.publishAt = { lte: now };
    where.targetAudience = { not: "BARANGAY_OFFICIALS" };
    andClauses.push({ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });
  }
  if (filters.search) {
    const q = filters.search.trim();
    andClauses.push({ OR: [{ title: { contains: q } }, { summary: { contains: q } }, { content: { contains: q } }] });
  }
  if (andClauses.length) where.AND = andClauses;

  const [rows, total, categoryMap] = await Promise.all([
    db.newsArticle.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { publishAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.newsArticle.count({ where }),
    getNewsCategoryMap(),
  ]);

  let posts = rows.map((r) => toNewsPostDTO(r, categoryMap));
  // emergency posts first within the same pinned group on the default public listing
  if (filters.publicOnly && !filters.category && !filters.search) {
    posts = posts.sort(
      (a, b) =>
        (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
        (b.emergency ? 1 : 0) - (a.emergency ? 1 : 0) ||
        new Date(b.publishAt).getTime() - new Date(a.publishAt).getTime()
    );
  }
  return { posts, total, page, pageSize };
}

/** Public detail + related posts (same category, latest 3, excluding itself). */
export async function getPublicNewsPost(
  id: string
): Promise<{ post: NewsPostDTO; related: NewsPostDTO[] } | null> {
  const now = new Date();
  const article = await db.newsArticle.findUnique({ where: { id } });
  if (
    !article ||
    article.status !== "PUBLISHED" ||
    article.publishAt > now ||
    (article.expiresAt && article.expiresAt <= now) ||
    article.targetAudience === "BARANGAY_OFFICIALS"
  ) {
    return null;
  }
  const categoryMap = await getNewsCategoryMap();
  const relatedRows = await db.newsArticle.findMany({
    where: {
      category: article.category,
      status: "PUBLISHED",
      publishAt: { lte: now },
      id: { not: article.id },
      targetAudience: { not: "BARANGAY_OFFICIALS" },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { publishAt: "desc" },
    take: 3,
  });
  return {
    post: toNewsPostDTO(article, categoryMap),
    related: relatedRows.map((r) => toNewsPostDTO(r, categoryMap)),
  };
}

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------

function sanitizeInput(input: NewsPostInput) {
  if (!input?.title || !String(input.title).trim()) throw new Error("Title is required.");
  if (String(input.title).trim().length > 200) throw new Error("Title must be at most 200 characters.");
  if (!input?.content || !String(input.content).trim()) throw new Error("Content is required.");

  const audience = ["ALL", "RESIDENTS", "BARANGAY_OFFICIALS"].includes(String(input.targetAudience))
    ? String(input.targetAudience)
    : "ALL";
  const status = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"].includes(String(input.status))
    ? (String(input.status) as NewsPostStatus)
    : "DRAFT";

  let publishAt = new Date();
  if (input.publishAt) {
    const d = new Date(input.publishAt);
    if (isNaN(d.getTime())) throw new Error("Publication date is not a valid date/time.");
    publishAt = d;
  }
  let expiresAt: Date | null = null;
  if (input.expiresAt) {
    const d = new Date(input.expiresAt);
    if (isNaN(d.getTime())) throw new Error("Expiration date is not a valid date/time.");
    expiresAt = d;
  }

  const tags = Array.isArray(input.tags)
    ? input.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 20)
    : [];
  const gallery = Array.isArray(input.gallery)
    ? input.gallery.map((g) => String(g).trim()).filter(Boolean).slice(0, 30)
    : [];
  const attachments = Array.isArray(input.attachments)
    ? input.attachments
        .filter((a) => a && typeof a === "object" && String((a as { url?: unknown }).url || "").trim())
        .slice(0, 20)
        .map((a) => ({
          title: String((a as { title?: unknown }).title ?? "Attachment").trim().slice(0, 200),
          url: String((a as { url?: unknown }).url).trim().slice(0, 500),
          size: Number.isFinite(Number((a as { size?: unknown }).size))
            ? Math.max(0, Math.round(Number((a as { size?: unknown }).size)))
            : undefined,
        }))
    : [];
  const links = Array.isArray(input.links)
    ? input.links
        .filter((l) => l && typeof l === "object" && String((l as { url?: unknown }).url || "").trim())
        .slice(0, 20)
        .map((l) => ({
          label: String((l as { label?: unknown }).label ?? "Link").trim().slice(0, 120),
          url: String((l as { url?: unknown }).url).trim().slice(0, 500),
        }))
    : [];

  return {
    title: String(input.title).trim(),
    subtitle: input.subtitle ? String(input.subtitle).trim().slice(0, 300) : null,
    summary: input.summary ? String(input.summary).trim().slice(0, 600) : null,
    content: sanitizeRichText(input.content, 60000),
    author: input.author ? String(input.author).trim().slice(0, 120) : null,
    tags: tags.join(","),
    featuredImage: input.featuredImage ? String(input.featuredImage).trim().slice(0, 500) : null,
    galleryJson: JSON.stringify(gallery),
    attachmentsJson: JSON.stringify(attachments),
    linksJson: JSON.stringify(links),
    publishAt,
    expiresAt,
    targetAudience: audience,
    targetBarangays:
      Array.isArray(input.targetBarangays) && input.targetBarangays.length
        ? input.targetBarangays.map((b) => String(b).trim()).filter(Boolean).slice(0, 33).join(",")
        : null,
    pushEnabled: input.pushEnabled === true,
    emergency: input.emergency === true,
    featured: input.featured === true,
    pinned: input.pinned === true,
    status,
    linkUrl: input.linkUrl ? String(input.linkUrl).trim().slice(0, 500) : null,
  };
}

/**
 * Create or update a news post (upsert when id provided).
 * The category must be an ACTIVE NewsCategory key.
 */
export async function savePost(input: {
  id?: string;
  data: NewsPostInput;
  actor: { id: string; name: string };
  action?: string; // audit action name
}): Promise<NewsPostDTO> {
  let data = input.data;
  let existing: NewsArticle | null = null;
  if (input.id) {
    existing = await db.newsArticle.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error("News post not found.");
    // partial update: merge the patch over the stored values
    data = {
      title: data.title ?? existing.title,
      category: data.category ?? existing.category,
      subtitle: data.subtitle !== undefined ? data.subtitle : existing.subtitle,
      summary: data.summary !== undefined ? data.summary : existing.summary,
      content: data.content ?? existing.content,
      author: data.author !== undefined ? data.author : existing.author,
      tags: data.tags ?? (existing.tags ? existing.tags.split(",").map((t) => t.trim()).filter(Boolean) : []),
      featuredImage: data.featuredImage !== undefined ? data.featuredImage : existing.featuredImage,
      gallery: data.gallery ?? safeJsonArray<string>(existing.galleryJson),
      attachments:
        data.attachments ?? safeJsonArray<NewsPostDTO["attachments"][number]>(existing.attachmentsJson),
      links: data.links ?? safeJsonArray<NewsPostDTO["links"][number]>(existing.linksJson),
      publishAt: data.publishAt !== undefined ? data.publishAt : existing.publishAt.toISOString(),
      expiresAt: data.expiresAt !== undefined ? data.expiresAt : existing.expiresAt?.toISOString() ?? null,
      targetAudience: data.targetAudience ?? existing.targetAudience,
      targetBarangays:
        data.targetBarangays !== undefined
          ? data.targetBarangays
          : existing.targetBarangays
            ? existing.targetBarangays.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
      pushEnabled: data.pushEnabled !== undefined ? data.pushEnabled : existing.pushEnabled,
      emergency: data.emergency !== undefined ? data.emergency : existing.emergency,
      featured: data.featured !== undefined ? data.featured : existing.featured,
      pinned: data.pinned !== undefined ? data.pinned : existing.pinned,
      status: data.status ?? (existing.status as NewsPostStatus),
      linkUrl: data.linkUrl !== undefined ? data.linkUrl : existing.linkUrl,
    };
  }
  if (!data?.category || !String(data.category).trim()) throw new Error("Category is required.");
  const category = await db.newsCategory.findUnique({ where: { key: String(data.category).trim() } });
  if (!category || !category.active) {
    throw new Error("Unknown or inactive news category. Pick one of the active categories.");
  }

  const sanitized = sanitizeInput(data);
  const payload = { ...sanitized, category: category.key, categoryId: category.id };

  let article: NewsArticle;
  if (input.id) {
    article = await db.newsArticle.update({ where: { id: input.id }, data: payload });
  } else {
    article = await db.newsArticle.create({
      data: { ...payload, createdById: input.actor.id, createdByName: input.actor.name },
    });
  }

  await logAudit({
    actorType: "ADMIN",
    actorName: input.actor.name,
    action: input.action ?? (input.id ? "NEWS_POST_UPDATED" : "NEWS_POST_CREATED"),
    detail: `${input.id ? "Updated" : "Created"} ${sanitized.status} post "${article.title}" (${category.name})`,
  });

  const categoryMap = await getNewsCategoryMap();
  return toNewsPostDTO(article, categoryMap);
}

/** Publish an existing post immediately (status PUBLISHED, publishAt now). */
export async function publishPost(input: {
  id: string;
  actor: { id: string; name: string };
}): Promise<NewsPostDTO> {
  const existing = await db.newsArticle.findUnique({ where: { id: input.id } });
  if (!existing) throw new Error("News post not found.");
  const article = await db.newsArticle.update({
    where: { id: input.id },
    data: { status: "PUBLISHED", publishAt: new Date() },
  });
  await logAudit({
    actorType: "ADMIN",
    actorName: input.actor.name,
    action: "NEWS_POST_PUBLISHED",
    detail: `Published "${article.title}" (${article.category})`,
  });
  const categoryMap = await getNewsCategoryMap();
  return toNewsPostDTO(article, categoryMap);
}
