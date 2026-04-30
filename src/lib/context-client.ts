/**
 * Minimal typed wrapper around the context.dev web-scraping API.
 * Docs: https://docs.context.dev/api-reference/web-scraping
 */

const API_BASE = "https://api.context.dev/v1";

export class ContextDevError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ContextDevError";
  }
}

/**
 * @param override - Per-user key from Settings; when absent or empty, uses `CONTEXT_DEV_API_KEY`.
 */
function resolveApiKey(override?: string | null): string {
  const trimmed = override?.trim();
  if (trimmed) return trimmed;
  const fromEnv = process.env.CONTEXT_DEV_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  throw new ContextDevError(
    "context.dev API key is not set. Add it in Settings or set CONTEXT_DEV_API_KEY in the environment.",
    500,
  );
}

async function request<T>(
  pathname: string,
  params: Record<string, string | number | boolean | undefined>,
  bearerToken: string,
): Promise<T> {
  const url = new URL(`${API_BASE}${pathname}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    let message = `context.dev responded ${res.status}`;
    let code: string | undefined;
    try {
      const body = (await res.json()) as {
        message?: string;
        error_code?: string;
      };
      if (body?.message) message = body.message;
      code = body?.error_code;
    } catch {
      // ignore — non-JSON error body
    }
    throw new ContextDevError(message, res.status, code);
  }

  return (await res.json()) as T;
}

async function postRequest<T>(pathname: string, body: Record<string, unknown>, bearerToken: string): Promise<T> {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let message = `context.dev responded ${res.status}`;
    let code: string | undefined;
    try {
      const errBody = (await res.json()) as { message?: string; error_code?: string };
      if (errBody?.message) message = errBody.message;
      code = errBody?.error_code;
    } catch {
      // non-JSON error body
    }
    throw new ContextDevError(message, res.status, code);
  }

  return (await res.json()) as T;
}

/**
 * @see https://docs.context.dev/api-reference/web-extraction/extract-a-single-product-from-a-url
 */
export interface ExtractProductResult {
  is_product_page: boolean;
  platform: "amazon" | "tiktok_shop" | "etsy" | "generic" | null;
  product: {
    name: string;
    description: string;
    price: number | null;
    currency: string | null;
    url?: string | null;
  } | null;
}

export interface ExtractProductOptions {
  timeoutMS?: number;
  /** Per-user key; falls back to CONTEXT_DEV_API_KEY. */
  apiKey?: string | null;
}

export async function extractProduct(
  url: string,
  options: ExtractProductOptions = {},
): Promise<ExtractProductResult> {
  const { apiKey, timeoutMS } = options;
  const key = resolveApiKey(apiKey);
  const body: Record<string, unknown> = { url };
  if (timeoutMS !== undefined) body.timeoutMS = timeoutMS;
  return postRequest<ExtractProductResult>("/brand/ai/product", body, key);
}

export interface ScrapeMarkdownResult {
  success: boolean;
  markdown: string;
  url: string;
}

export interface ScrapeSitemapResult {
  success: boolean;
  domain: string;
  urls: string[];
  meta: {
    sitemapsDiscovered: number;
    sitemapsFetched: number;
    sitemapsSkipped: number;
    errors: number;
  };
}

export interface ScrapeMarkdownOptions {
  includeLinks?: boolean;
  includeImages?: boolean;
  shortenBase64Images?: boolean;
  useMainContentOnly?: boolean;
  /** Cache duration in ms. 0 forces a fresh scrape. */
  maxAgeMs?: number;
  /** Per-user key; falls back to CONTEXT_DEV_API_KEY. */
  apiKey?: string | null;
}

export async function scrapeMarkdown(
  url: string,
  options: ScrapeMarkdownOptions = {},
): Promise<ScrapeMarkdownResult> {
  const { apiKey, maxAgeMs: _m, ...rest } = options;
  const key = resolveApiKey(apiKey);
  return request<ScrapeMarkdownResult>(
    "/web/scrape/markdown",
    {
      url,
      includeLinks: rest.includeLinks,
      includeImages: rest.includeImages,
      shortenBase64Images: rest.shortenBase64Images,
      useMainContentOnly: rest.useMainContentOnly ?? true,
      maxAgeMs: 0,
    },
    key,
  );
}

export interface ScrapeSitemapOptions {
  maxLinks?: number;
  urlRegex?: string;
  /** Per-user key; falls back to CONTEXT_DEV_API_KEY. */
  apiKey?: string | null;
}

export async function scrapeSitemap(
  domain: string,
  options: ScrapeSitemapOptions = {},
): Promise<ScrapeSitemapResult> {
  const { apiKey, ...rest } = options;
  const key = resolveApiKey(apiKey);
  return request<ScrapeSitemapResult>(
    "/web/scrape/sitemap",
    {
      domain,
      maxLinks: rest.maxLinks,
      urlRegex: rest.urlRegex,
    },
    key,
  );
}

/**
 * @see https://docs.context.dev/api-reference/web-scraping/scrape-screenshot
 */
export interface ScrapeScreenshotResult {
  status: string;
  domain: string;
  screenshot: string;
  screenshotType: "viewport" | "fullPage";
  code: number;
}

export interface ScrapeScreenshotOptions {
  /** Normalized domain (e.g. example.com) — home page. Mutually exclusive with `directUrl`. */
  domain?: string;
  /** Exact URL to capture. Mutually exclusive with `domain`. */
  directUrl?: string;
  fullScreenshot?: boolean;
  prioritize?: "speed" | "quality";
  /** Per-user key; falls back to CONTEXT_DEV_API_KEY. */
  apiKey?: string | null;
}

export async function scrapeScreenshot(
  options: ScrapeScreenshotOptions = {},
): Promise<ScrapeScreenshotResult> {
  const { apiKey, domain, directUrl, fullScreenshot, prioritize } = options;
  const key = resolveApiKey(apiKey);
  if (domain && directUrl) {
    throw new ContextDevError("Pass either domain or directUrl, not both.", 400);
  }
  if (!domain && !directUrl) {
    throw new ContextDevError("Pass domain or directUrl for screenshot.", 400);
  }
  return request<ScrapeScreenshotResult>(
    "/web/screenshot",
    {
      domain: domain ?? undefined,
      directUrl: directUrl ?? undefined,
      fullScreenshot: fullScreenshot ? "true" : fullScreenshot === false ? "false" : undefined,
      prioritize: prioritize,
    },
    key,
  );
}

export function parseDomain(input: string): string {
  try {
    return new URL(input).hostname;
  } catch {
    // Caller may have already passed a bare domain like "example.com".
    return input.replace(/^https?:\/\//, "").split("/")[0];
  }
}

export function normalizeDomain(input: string): string | null {
  const raw = parseDomain(input)
    .trim()
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  if (!raw || !raw.includes(".")) return null;
  if (!/^[a-z0-9.-]+$/.test(raw)) return null;
  return raw;
}

export interface BrandColor {
  hex: string;
  name?: string;
}

export interface BrandLogo {
  url: string;
  mode?: "light" | "dark" | "has_opaque_background";
  type?: "icon" | "logo";
  colors?: BrandColor[];
  resolution?: { width: number; height: number; aspect_ratio: number };
}

export interface BrandBackdrop {
  url: string;
  colors?: BrandColor[];
  resolution?: { width: number; height: number; aspect_ratio: number };
}

export interface BrandData {
  domain: string;
  title?: string;
  description?: string;
  slogan?: string;
  logos?: BrandLogo[];
  backdrops?: BrandBackdrop[];
  colors?: BrandColor[];
}

interface RetrieveBrandResponse {
  status: string;
  code: number;
  brand: BrandData;
}

export async function retrieveBrand(
  domain: string,
  options?: { apiKey?: string | null },
): Promise<BrandData> {
  const key = resolveApiKey(options?.apiKey);
  const res = await request<RetrieveBrandResponse>(
    "/brand/retrieve",
    {
      domain,
    },
    key,
  );
  return res.brand;
}

/**
 * Retrieves brand assets from the signup email domain, or reports freemail/disposable (422).
 * Does not fall back to `CONTEXT_DEV_API_KEY` — callers must pass the submitted key.
 * @see https://docs.context.dev/api-reference/brand-intelligence/retrieve-brand-data-by-email-address.md
 */
export async function tryRetrieveBrandByEmail(
  email: string,
  bearerToken: string,
): Promise<{ outcome: "brand"; brand: BrandData } | { outcome: "free_or_disposable" }> {
  const key = bearerToken.trim();
  if (!key) {
    throw new ContextDevError("API key required", 400);
  }

  const url = new URL(`${API_BASE}/brand/retrieve-by-email`);
  url.searchParams.set("email", email.trim());

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  });

  if (res.status === 422) {
    let errorCode: string | undefined;
    let message = `context.dev responded 422`;
    try {
      const body = (await res.json()) as { error_code?: string; message?: string };
      errorCode = body?.error_code;
      if (body?.message) message = body.message;
    } catch {
      /* non-JSON */
    }
    if (errorCode === "FREE_EMAIL_DETECTED" || errorCode === "DISPOSABLE_EMAIL_DETECTED") {
      return { outcome: "free_or_disposable" };
    }
    throw new ContextDevError(message, 422, errorCode);
  }

  if (!res.ok) {
    let message = `context.dev responded ${res.status}`;
    let code: string | undefined;
    try {
      const body = (await res.json()) as { message?: string; error_code?: string };
      if (body?.message) message = body.message;
      code = body?.error_code;
    } catch {
      /* ignore */
    }
    throw new ContextDevError(message, res.status, code);
  }

  const data = (await res.json()) as RetrieveBrandResponse;
  return { outcome: "brand", brand: data.brand };
}

/** Confirms an API key is valid when retrieve-by-email is not usable (freemail/disposable inbox). */
export async function smokeVerifyContextApiKey(apiKey: string): Promise<void> {
  await retrieveBrand("example.com", { apiKey });
}

export interface BrandAssets {
  title: string | null;
  description: string | null;
  logoUrl: string | null;
  backdropUrl: string | null;
}

export function pickBrandAssets(
  brand: BrandData | null | undefined,
): BrandAssets {
  if (!brand)
    return { title: null, description: null, logoUrl: null, backdropUrl: null };
  const logos = brand.logos ?? [];
  const pickedLogo =
    logos.find((l) => l.type === "icon" && l.mode === "light") ??
    logos.find((l) => l.type === "icon" && l.mode !== "dark") ??
    logos.find((l) => l.type === "icon") ??
    logos.find((l) => l.mode !== "dark") ??
    logos[0] ??
    null;
  const backdrop = (brand.backdrops ?? [])[0] ?? null;
  return {
    title: brand.title?.trim() || null,
    description: brand.description?.trim() || null,
    logoUrl: pickedLogo?.url ?? null,
    backdropUrl: backdrop?.url ?? null,
  };
}
