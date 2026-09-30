// Server-only FPL API client. The FPL API blocks browser CORS requests, so all
// fetching happens here, behind a Postgres cache in public.api_cache.

const BASE = "https://fantasy.premierleague.com/api";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

export const TTL = {
  bootstrap: 30 * 60,
  standings: 15 * 60,
  manager: 10 * 60,
  picksPast: 24 * 60 * 60,
  picksLive: 10 * 60,
  fixtures: 60 * 60,
} as const;

export class FplError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

async function fetchWithTimeout(url: string, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "Accept-Language": "en-GB,en;q=0.9",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch raw JSON from the FPL API with retries. */
export async function fplFetch<T>(path: string, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(`${BASE}${path}`);
      if (res.status === 404) throw new FplError("Not found on the FPL API.", 404);
      if (res.status === 503) throw new FplError("The FPL API is updating right now.", 503);
      if (!res.ok) throw new FplError(`FPL API responded with ${res.status}.`, 502);
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
      if (error instanceof FplError && error.status === 404) throw error;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  if (lastError instanceof FplError) throw lastError;
  throw new FplError("Could not reach the FPL API.");
}

type CacheHit<T> = { data: T; fetchedAt: string; stale: boolean };

/**
 * Cache-first read: serves fresh cache, otherwise refetches. If FPL is down and
 * stale data exists, the stale copy is served with `stale: true`.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<CacheHit<T>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: row } = await supabaseAdmin
    .from("api_cache")
    .select("payload, fetched_at")
    .eq("key", key)
    .maybeSingle();

  const fetchedAt = row?.fetched_at as string | undefined;
  const ageSeconds = fetchedAt ? (Date.now() - new Date(fetchedAt).getTime()) / 1000 : Infinity;

  if (row && ageSeconds < ttlSeconds) {
    return { data: row.payload as T, fetchedAt: fetchedAt!, stale: false };
  }

  try {
    const fresh = await loader();
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("api_cache")
      .upsert({ key, payload: fresh as never, fetched_at: now }, { onConflict: "key" });
    return { data: fresh, fetchedAt: now, stale: false };
  } catch (error) {
    if (row) return { data: row.payload as T, fetchedAt: fetchedAt!, stale: true };
    throw error;
  }
}
