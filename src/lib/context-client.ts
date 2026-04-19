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

function apiKey(): string {
  const key = process.env.CONTEXT_DEV_API_KEY;
  if (!key) throw new ContextDevError("CONTEXT_DEV_API_KEY is not set", 500);
  return key;
}

async function request<T>(
  pathname: string,
  params: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const url = new URL(`${API_BASE}${pathname}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
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
}

export async function scrapeMarkdown(
  url: string,
  options: ScrapeMarkdownOptions = {},
): Promise<ScrapeMarkdownResult> {
  return request<ScrapeMarkdownResult>("/web/scrape/markdown", {
    url,
    includeLinks: options.includeLinks,
    includeImages: options.includeImages,
    shortenBase64Images: options.shortenBase64Images,
    useMainContentOnly: options.useMainContentOnly ?? true,
    maxAgeMs: 0,
  });
}

export interface ScrapeSitemapOptions {
  maxLinks?: number;
  urlRegex?: string;
}

export async function scrapeSitemap(
  domain: string,
  options: ScrapeSitemapOptions = {},
): Promise<ScrapeSitemapResult> {
  return request<ScrapeSitemapResult>("/web/scrape/sitemap", {
    domain,
    maxLinks: options.maxLinks,
    urlRegex: options.urlRegex,
  });
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

export async function retrieveBrand(domain: string): Promise<BrandData> {
  const res = await request<RetrieveBrandResponse>("/brand/retrieve", {
    domain,
  });
  return res.brand;
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
