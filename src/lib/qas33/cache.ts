// QAS33 — process-wide in-memory cache (single SQLite node, no Redis needed).
//
// A tiny TTL cache with:
//   • entry expiry (fresh window) + stale-while-revalidate window — after the
//     fresh window expires, the last good value is served IMMEDIATELY while a
//     single background refresh runs, so slow queries / upstream APIs never
//     block a public page render;
//   • in-flight de-duplication (thundering-herd protection: N concurrent
//     callers share one pending promise);
//   • prefix-based invalidation (called when admins publish new content);
//   • resilience — if a refresh throws, the previous value keeps serving
//     until its stale window lapses.
//
// Values are stored per-process (Next.js dev/prod both run a single server
// process here), which is exactly the right scope for this deployment.

interface CacheEntry {
  value: unknown;
  /** End of the fresh window (served without recompute). */
  freshUntil: number;
  /** End of the stale window (served while a background refresh runs). */
  staleUntil: number;
}

const store = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

/** Safety bound so the map can never grow without limit. */
const MAX_ENTRIES = 500;

export interface CachedOptions {
  /** Serve-stale window beyond ttl (default: 4 × ttl). */
  staleMs?: number;
}

/**
 * Returns the cached value for `key`, recomputing it with `fn` when the fresh
 * window (ttlMs) has passed. Never memoizes errors unless a previous good
 * value exists — in that case the stale value is returned and the error is
 * swallowed after being logged.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  opts: CachedOptions = {}
): Promise<T> {
  const now = Date.now();
  const entry = store.get(key);

  // Fresh → serve directly.
  if (entry && entry.freshUntil > now) return entry.value as T;

  // Stale-but-usable → serve instantly, refresh exactly once in the background.
  if (entry && entry.staleUntil > now) {
    if (!inflight.has(key)) {
      const refresh = fn()
        .then((value) => {
          store.set(key, makeEntry(value, ttlMs, opts.staleMs));
          inflight.delete(key);
          return value;
        })
        .catch((err) => {
          inflight.delete(key);
          // Keep serving the previous value until its stale window lapses.
          console.error(`cache: background refresh failed for ${key}`, err);
        });
      inflight.set(key, refresh);
    }
    return entry.value as T;
  }

  // Nothing usable → compute (de-duplicated across concurrent callers).
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const compute = fn()
    .then((value) => {
      store.set(key, makeEntry(value, ttlMs, opts.staleMs));
      inflight.delete(key);
      return value;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });
  inflight.set(key, compute);
  return compute;
}

function makeEntry(value: unknown, ttlMs: number, staleMs?: number): CacheEntry {
  if (store.size > MAX_ENTRIES) store.clear(); // crude bound; keys are few
  const now = Date.now();
  return {
    value,
    freshUntil: now + ttlMs,
    staleUntil: now + ttlMs + (staleMs ?? ttlMs * 4),
  };
}

/** Drop every entry whose key starts with `prefix` (e.g. "public:"). */
export function invalidateCache(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
