"use client";

// QAS33 Public Portal — News & Public Updates section (live upgrade).
//
// Fetches GET /api/public/news in-section (page size 6, load-more increments):
// featured banner (featured/emergency first), category filter chips (All +
// active categories, emergency chips red-tinted), search box, post cards with
// emergency accent styling, and a detail dialog with the full server-sanitized
// rich-text content, gallery, attachments, external links, share buttons
// (Copy Link / Facebook / X / WhatsApp → origin + ?news=ID) and related posts.
// Supports the ?news=ID deep link: on mount the referenced post opens
// automatically.

import * as React from "react";
import {
  Calendar,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Facebook,
  Link as LinkIcon,
  Loader2,
  MessageCircle,
  Newspaper,
  Pin,
  Search,
  Siren,
  X as XIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  NewsCategoryDTO,
  NewsPostDTO,
  PushStatusDTO,
} from "@/lib/qas33/emergency-types";
import { formatDateTimePH, timeAgo, PortalIcon } from "./portal-shared";
import { PortalPushCard } from "./portal-push";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

interface NewsListResponse {
  posts: NewsPostDTO[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  categories: NewsCategoryDTO[];
}

interface NewsDetailResponse {
  post: NewsPostDTO;
  related: NewsPostDTO[];
}

const PAGE_SIZE = 6;

/** Category color token → chip classes (static Tailwind map). */
const CATEGORY_CHIP: Record<string, string> = {
  red: "border-red-200 bg-red-50 text-red-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  sky: "border-sky-200 bg-sky-50 text-sky-800",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  blue: "border-gov-blue-100 bg-gov-blue-50 text-gov-blue",
  violet: "border-violet-200 bg-violet-50 text-violet-800",
  teal: "border-teal-200 bg-teal-50 text-teal-800",
  orange: "border-orange-200 bg-orange-50 text-orange-800",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
};

function categoryChipCls(c: NewsCategoryDTO): string {
  return CATEGORY_CHIP[c.color] ?? CATEGORY_CHIP.slate;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NewsSectionBody({ pushStatus }: { pushStatus?: PushStatusDTO | null }) {
  const { toast } = useToast();

  const [posts, setPosts] = React.useState<NewsPostDTO[]>([]);
  const [categories, setCategories] = React.useState<NewsCategoryDTO[]>([]);
  const [total, setTotal] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [category, setCategory] = React.useState("ALL");
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");

  // Detail dialog
  const [openPost, setOpenPost] = React.useState<NewsPostDTO | null>(null);
  const [related, setRelated] = React.useState<NewsPostDTO[]>([]);
  const [detailLoading, setDetailLoading] = React.useState(false);

  // Monotonic request sequence guards — out-of-order responses from a
  // superseded request (filter/search/detail changed while in flight) must
  // never clobber the newer state.
  const listSeq = React.useRef(0);
  const detailSeq = React.useRef(0);

  // ---- data fetching ------------------------------------------------------

  const fetchList = React.useCallback(
    async (opts: { page: number; append: boolean; category?: string; search?: string }) => {
      const cat = opts.category ?? category;
      const q = opts.search ?? search;
      const seq = ++listSeq.current;
      if (opts.append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(opts.page), pageSize: String(PAGE_SIZE) });
        if (cat !== "ALL") params.set("category", cat);
        if (q.trim()) params.set("search", q.trim());
        const res = await fetch(`/api/public/news?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = (await res.json()) as NewsListResponse;
        if (seq !== listSeq.current) return; // stale response — a newer request is in flight
        setPosts((prev) => (opts.append ? [...prev, ...data.posts] : data.posts));
        setCategories(data.categories);
        setTotal(data.total);
        setHasMore(data.hasMore);
        setPage(data.page);
      } catch {
        if (seq !== listSeq.current) return;
        setError("Unable to load news right now. Please try again.");
        if (!opts.append) setPosts([]);
      } finally {
        if (seq === listSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [category, search]
  );

  // Debounce the search box.
  React.useEffect(() => {
    const t = window.setTimeout(() => setSearch((cur) => (cur === searchInput ? cur : searchInput)), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    void fetchList({ page: 1, append: false });
  }, [category, search]);

  // Initial load + ?news=ID deep link.
  React.useEffect(() => {
    void fetchList({ page: 1, append: false });
    const deepId = new URLSearchParams(window.location.search).get("news");
    if (deepId) {
      void (async () => {
        setDetailLoading(true);
        try {
          const res = await fetch(`/api/public/news/${encodeURIComponent(deepId)}`, { cache: "no-store" });
          if (res.ok) {
            const data = (await res.json()) as NewsDetailResponse;
            setOpenPost(data.post);
            setRelated(data.related);
          }
        } catch {
          /* deep link is best-effort */
        } finally {
          setDetailLoading(false);
        }
      })();
    }
  }, []);

  const openDetail = async (post: NewsPostDTO) => {
    setOpenPost(post);
    setRelated([]);
    setDetailLoading(true);
    const seq = ++detailSeq.current;
    try {
      const res = await fetch(`/api/public/news/${post.id}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as NewsDetailResponse;
        if (seq !== detailSeq.current) return; // a newer detail request is in flight
        setOpenPost(data.post);
        setRelated(data.related);
      }
    } catch {
      /* keep the card data */
    } finally {
      if (seq === detailSeq.current) setDetailLoading(false);
    }
  };

  const shareUrl = openPost ? `${window.location.origin}/?news=${openPost.id}` : "";

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Link copied", description: "Share it with your neighbors and community group chats." });
    } catch {
      toast({ title: "Could not copy", description: "Copy the address from your browser's address bar instead." });
    }
  };

  // ---- render helpers ------------------------------------------------------

  const featured = posts.find((p) => p.featured) ?? posts.find((p) => p.emergency) ?? null;
  const rest = posts.filter((p) => p !== featured);

  const PostCard = ({ n, compact }: { n: NewsPostDTO; compact?: boolean }) => (
    <article
      className={cn(
        "flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl portal-glass transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold",
        n.emergency || n.categoryEmergency ? "border-l-4 border-l-red-600" : ""
      )}
      onClick={() => void openDetail(n)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void openDetail(n);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Read: ${n.title}`}
    >
      {!compact ? (
        <div className="relative h-36 bg-gradient-to-br from-gov-blue-deep to-gov-blue-700">
          {n.featuredImage ? (
            <img src={n.featuredImage} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-gov-gold/80">
              <Newspaper aria-hidden="true" className="size-8" />
            </span>
          )}
          {n.emergency || n.categoryEmergency ? (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emergency-red px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
              <Siren aria-hidden="true" className="size-3" />
              Emergency
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-gov-blue-100 bg-gov-blue-50 text-[10px] font-semibold text-gov-blue">
            {n.categoryName}
          </Badge>
          {n.pinned ? <Pin aria-hidden="true" className="size-3.5 text-gov-gold-dark" /> : null}
          <span className="text-[11px] text-slate-400">{timeAgo(n.publishAt)}</span>
        </div>
        <h3 className="mt-2.5 font-semibold leading-snug text-slate-900">{n.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-500">{n.summary || n.excerpt}</p>
        <div className="mt-auto pt-3">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gov-blue underline-offset-2">
            Read more
            <PortalIcon name="arrow-right" className="size-3" />
          </span>
        </div>
      </div>
    </article>
  );

  return (
    <div className="space-y-6">
      {/* Push subscription card */}
      {pushStatus ? <PortalPushCard pushStatus={pushStatus} context="news" /> : null}

      {/* Category chips + search */}
      <div className="flex flex-col gap-3">
        <div className="portal-no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter news by category">
          <button
            type="button"
            aria-pressed={category === "ALL"}
            onClick={() => setCategory("ALL")}
            className={cn(
              "min-h-9 shrink-0 rounded-full border px-4 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold",
              category === "ALL"
                ? "border-gov-blue bg-gov-blue text-white"
                : "border-slate-300 bg-white text-slate-600 hover:border-gov-blue hover:text-gov-blue"
            )}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={category === c.key}
              onClick={() => setCategory(c.key)}
              className={cn(
                "min-h-9 shrink-0 rounded-full border px-4 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold",
                c.emergency ? "border-red-300 bg-red-50/70 text-red-800 hover:border-red-500" : "",
                category === c.key
                  ? c.emergency
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-gov-blue bg-gov-blue text-white"
                  : !c.emergency
                  ? "border-slate-300 bg-white text-slate-600 hover:border-gov-blue hover:text-gov-blue"
                  : ""
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="relative max-w-md">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search news and updates…"
            aria-label="Search news"
            className="h-10 pl-9 text-sm"
          />
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-5" aria-busy="true">
          <div className="h-56 animate-pulse rounded-2xl bg-slate-200/70" />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-200/70" />
            ))}
          </div>
        </div>
      ) : error && posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl portal-glass px-6 py-14 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gov-blue-50 text-gov-blue">
            <Newspaper aria-hidden="true" className="size-7" />
          </span>
          <h3 className="mt-4 text-base font-semibold text-slate-800">News temporarily unavailable</h3>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">{error}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-5 h-10 gap-2 border-slate-300 text-slate-700 hover:border-gov-blue hover:text-gov-blue"
            onClick={() => void fetchList({ page: 1, append: false })}
          >
            Retry
          </Button>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl portal-glass px-6 py-14 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gov-blue-50 text-gov-blue">
            <Newspaper aria-hidden="true" className="size-7" />
          </span>
          <h3 className="mt-4 text-base font-semibold text-slate-800">
            {search || category !== "ALL" ? "No articles match your filters" : "No news yet"}
          </h3>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">
            {search || category !== "ALL"
              ? "Try a different keyword or category."
              : "News and public updates from the MDRRMO will be published here."}
          </p>
        </div>
      ) : (
        <>
          {/* Featured banner */}
          {featured ? (
            <article
              className={cn(
                "overflow-hidden rounded-2xl portal-glass transition-shadow hover:shadow-md",
                featured.emergency || featured.categoryEmergency ? "border-l-4 border-l-red-600" : ""
              )}
            >
              <div className="grid md:grid-cols-[2fr_3fr]">
                <div className="relative min-h-48 bg-gradient-to-br from-gov-blue-deep via-gov-blue to-gov-blue-700">
                  {featured.featuredImage ? (
                    <img src={featured.featuredImage} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-gov-gold">
                      <Newspaper aria-hidden="true" className="size-14" />
                    </span>
                  )}
                </div>
                <div className="flex flex-col p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-gov-blue-100 bg-gov-blue-50 text-[10px] font-semibold text-gov-blue">
                      {featured.categoryName}
                    </Badge>
                    {featured.emergency || featured.categoryEmergency ? (
                      <Badge variant="outline" className="border-red-200 bg-red-50 text-[10px] font-bold text-red-800">
                        <Siren aria-hidden="true" className="mr-1 size-3" />
                        EMERGENCY
                      </Badge>
                    ) : null}
                    <span className="text-xs text-slate-400">{formatDateTimePH(featured.publishAt)}</span>
                    {featured.pinned ? <Pin aria-hidden="true" className="size-3.5 text-gov-gold-dark" /> : null}
                  </div>
                  <h3 className="mt-3 text-xl font-bold leading-snug text-slate-900">{featured.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">
                    {featured.summary || featured.excerpt}
                  </p>
                  <div className="mt-auto pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void openDetail(featured)}
                      className="h-11 gap-2 border-slate-300 font-semibold text-gov-blue hover:border-gov-blue hover:bg-gov-blue-50"
                    >
                      Read more
                      <PortalIcon name="arrow-right" className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ) : null}

          {/* Grid */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((n) => (
              <PostCard key={n.id} n={n} />
            ))}
          </div>

          {/* Load more */}
          {hasMore ? (
            <div className="text-center">
              <Button
                type="button"
                variant="outline"
                disabled={loadingMore}
                onClick={() => void fetchList({ page: page + 1, append: true })}
                className="h-11 gap-2 border-slate-300 px-6 font-semibold text-gov-blue hover:border-gov-blue hover:bg-gov-blue-50"
              >
                {loadingMore ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                Load more updates
                <span className="text-xs font-normal text-slate-500">
                  ({posts.length} of {total})
                </span>
              </Button>
            </div>
          ) : (
            <p className="text-center text-xs text-slate-400">
              Showing all {total} published update{total === 1 ? "" : "s"}.
            </p>
          )}
        </>
      )}

      {/* Detail dialog */}
      <Dialog open={!!openPost} onOpenChange={(o) => !o && setOpenPost(null)}>
        <DialogContent className="max-h-[88dvh] w-[95vw] max-w-2xl overflow-y-auto portal-scroll">
          <DialogHeader>
            <DialogTitle className="pr-8 text-lg font-bold leading-snug text-gov-blue-deep">{openPost?.title}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2">
              {openPost ? (
                <>
                  <Badge variant="outline" className="border-gov-blue-100 bg-gov-blue-50 text-[10px] font-semibold text-gov-blue">
                    {openPost.categoryName}
                  </Badge>
                  <span>{formatDateTimePH(openPost.publishAt)}</span>
                  {openPost.author ? <span>· By {openPost.author}</span> : null}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {openPost ? (
            <div className="space-y-5">
              {openPost.emergency || openPost.categoryEmergency ? (
                <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                  <Siren aria-hidden="true" className="size-4 shrink-0" />
                  Emergency advisory — follow official instructions from the MDRRMO.
                </p>
              ) : null}

              {openPost.subtitle ? (
                <p className="text-sm font-semibold leading-relaxed text-slate-700">{openPost.subtitle}</p>
              ) : null}

              {openPost.featuredImage ? (
                <img
                  src={openPost.featuredImage}
                  alt=""
                  className="max-h-80 w-full rounded-xl border border-slate-200/70 object-cover"
                />
              ) : null}

              {detailLoading ? (
                <div className="space-y-3" aria-busy="true">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-4 animate-pulse rounded bg-slate-200/70" />
                  ))}
                </div>
              ) : (
                <div
                  className="prose-portal text-sm leading-relaxed text-slate-700"
                  dangerouslySetInnerHTML={{ __html: openPost.content }}
                />
              )}

              {openPost.gallery.length > 0 ? (
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Photos</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {openPost.gallery.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`${openPost.title} — photo ${i + 1}`}
                        className="h-28 w-full rounded-lg border border-slate-200/70 object-cover"
                        loading="lazy"
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {openPost.attachments.length > 0 ? (
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Attachments</p>
                  <ul className="space-y-2">
                    {openPost.attachments.map((att, i) => (
                      <li key={i}>
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-gov-blue transition-colors hover:border-gov-blue hover:bg-gov-blue-50"
                        >
                          <FileText aria-hidden="true" className="size-4 shrink-0" />
                          <span className="truncate">{att.title || `Attachment ${i + 1}`}</span>
                          <ExternalLink aria-hidden="true" className="ml-auto size-3.5 shrink-0" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {openPost.links.length > 0 ? (
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">Related links</p>
                  <ul className="space-y-2">
                    {openPost.links.map((l, i) => (
                      <li key={i}>
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-11 items-center gap-2.5 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-gov-blue transition-colors hover:border-gov-blue hover:bg-gov-blue-50"
                        >
                          <LinkIcon aria-hidden="true" className="size-4 shrink-0" />
                          <span className="truncate">{l.label || l.url}</span>
                          <ExternalLink aria-hidden="true" className="ml-auto size-3.5 shrink-0" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Share row */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Share this update</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyLink()}
                    className="h-10 gap-1.5 border-slate-300 text-slate-700 hover:border-gov-blue hover:text-gov-blue"
                  >
                    <Copy aria-hidden="true" className="size-3.5" />
                    Copy Link
                  </Button>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-gov-blue hover:text-gov-blue"
                  >
                    <Facebook aria-hidden="true" className="size-3.5" />
                    Facebook
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(openPost.title)}&url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-gov-blue hover:text-gov-blue"
                  >
                    <XIcon aria-hidden="true" className="size-3.5" />
                    X
                  </a>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${openPost.title} — ${shareUrl}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-gov-blue hover:text-gov-blue"
                  >
                    <MessageCircle aria-hidden="true" className="size-3.5" />
                    WhatsApp
                  </a>
                </div>
              </div>

              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar aria-hidden="true" className="size-3" />
                  Published {formatDateTimePH(openPost.publishAt)}
                </span>
                {openPost.expiresAt ? (
                  <span className="flex items-center gap-1">
                    <Check aria-hidden="true" className="size-3" />
                    Available until {formatDateTimePH(openPost.expiresAt)}
                  </span>
                ) : null}
              </p>

              {/* Related posts */}
              {related.length > 0 ? (
                <div>
                  <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Related updates</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {related.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => void openDetail(r)}
                        className="flex h-full flex-col rounded-xl border border-slate-200/70 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wide text-gov-blue">{r.categoryName}</span>
                        <span className="mt-1.5 line-clamp-3 text-xs font-semibold leading-snug text-slate-800">{r.title}</span>
                        <span className="mt-auto pt-2 text-[10px] text-slate-400">{timeAgo(r.publishAt)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
