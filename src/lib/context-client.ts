/**
 * Typed wrapper around the context.dev TypeScript SDK.
 * Docs: https://docs.context.dev/api-reference
 */

import ContextDev, { APIError } from "context.dev";
import { normalizeDomain, parseDomain } from "./domain";
import { effectiveContextDevApiKey } from "./server-managed-config";

export { normalizeDomain, parseDomain } from "./domain";

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
 * @param override - Per-account key from Settings; ignored when `CONTEXT_DEV_API_KEY`
 * is configured on the server.
 */
function resolveApiKey(override?: string | null): string {
  const key = effectiveContextDevApiKey(override);
  if (key) return key;
  throw new ContextDevError(
    "context.dev API key is not set. Add it in Settings or set CONTEXT_DEV_API_KEY in the environment.",
    500,
  );
}

function contextDevClient(apiKey?: string | null): ContextDev {
  return new ContextDev({ apiKey: resolveApiKey(apiKey), maxRetries: 0 });
}

function sdkErrorCode(error: object | undefined): string | undefined {
  if (!error) return undefined;
  const body = error as { error_code?: unknown; code?: unknown };
  if (typeof body.error_code === "string") return body.error_code;
  if (typeof body.code === "string") return body.code;
  return undefined;
}

function toContextDevError(err: unknown): ContextDevError {
  if (err instanceof ContextDevError) return err;
  if (err instanceof APIError) {
    return new ContextDevError(
      err.message || `context.dev responded ${err.status ?? 500}`,
      err.status ?? 500,
      sdkErrorCode(err.error),
    );
  }
  if (err instanceof Error) return new ContextDevError(err.message, 500);
  return new ContextDevError("context.dev request failed", 500);
}

async function withContextDevErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw toContextDevError(err);
  }
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
  /** Per-account key; server-managed key takes precedence when configured. */
  apiKey?: string | null;
}

export async function extractProduct(
  url: string,
  options: ExtractProductOptions = {},
): Promise<ExtractProductResult> {
  const { apiKey, timeoutMS } = options;
  const result = await withContextDevErrors(() =>
    contextDevClient(apiKey).ai.extractProduct({
      url,
      timeoutMS,
      maxAgeMs: 0,
    }),
  );

  return {
    is_product_page: result.is_product_page ?? false,
    platform: result.platform ?? null,
    product: result.product
      ? {
          name: result.product.name,
          description: result.product.description,
          price: result.product.price ?? null,
          currency: result.product.currency ?? null,
          url: result.product.url ?? null,
        }
      : null,
  };
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
  /** Per-account key; server-managed key takes precedence when configured. */
  apiKey?: string | null;
}

export async function scrapeMarkdown(
  url: string,
  options: ScrapeMarkdownOptions = {},
): Promise<ScrapeMarkdownResult> {
  const { apiKey, ...rest } = options;
  return withContextDevErrors(() =>
    contextDevClient(apiKey).web.webScrapeMd({
      url,
      includeLinks: rest.includeLinks,
      includeImages: rest.includeImages,
      shortenBase64Images: rest.shortenBase64Images,
      useMainContentOnly: rest.useMainContentOnly ?? true,
      maxAgeMs: 0,
    }),
  );
}

export interface ScrapeSitemapOptions {
  maxLinks?: number;
  urlRegex?: string;
  /** Per-account key; server-managed key takes precedence when configured. */
  apiKey?: string | null;
}

export async function scrapeSitemap(
  domain: string,
  options: ScrapeSitemapOptions = {},
): Promise<ScrapeSitemapResult> {
  const { apiKey, ...rest } = options;
  return withContextDevErrors(() =>
    contextDevClient(apiKey).web.webScrapeSitemap({
      domain,
      maxLinks: rest.maxLinks,
      urlRegex: rest.urlRegex,
    }),
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
  /** Per-account key; server-managed key takes precedence when configured. */
  apiKey?: string | null;
}

export async function scrapeScreenshot(
  options: ScrapeScreenshotOptions = {},
): Promise<ScrapeScreenshotResult> {
  const { apiKey, domain, directUrl, fullScreenshot, prioritize } = options;
  if (domain && directUrl) {
    throw new ContextDevError(
      "Pass either domain or directUrl, not both.",
      400,
    );
  }
  if (!domain && !directUrl) {
    throw new ContextDevError("Pass domain or directUrl for screenshot.", 400);
  }

  const query: ContextDev.WebScreenshotParams & {
    prioritize?: "speed" | "quality";
  } = {
    domain: domain ?? undefined,
    directUrl: directUrl ?? undefined,
    fullScreenshot: fullScreenshot
      ? "true"
      : fullScreenshot === false
        ? "false"
        : undefined,
    maxAgeMs: 0,
    prioritize,
  };
  const result = await withContextDevErrors(() =>
    contextDevClient(apiKey).web.screenshot(query),
  );

  return {
    status: result.status ?? "ok",
    domain: result.domain ?? domain ?? parseDomain(directUrl ?? ""),
    screenshot: result.screenshot ?? "",
    screenshotType:
      result.screenshotType ?? (fullScreenshot ? "fullPage" : "viewport"),
    code: result.code ?? 200,
  };
}

type SdkBrand = NonNullable<
  | ContextDev.BrandRetrieveResponse["brand"]
  | ContextDev.BrandRetrieveByEmailResponse["brand"]
>;

function toBrandData(
  brand: SdkBrand | undefined,
  fallbackDomain?: string,
): BrandData {
  if (!brand) {
    throw new ContextDevError(
      "context.dev response did not include brand data",
      502,
    );
  }

  const colors = brand.colors?.map((color) => ({
    hex: color.hex ?? "",
    name: color.name,
  }));
  const logos = brand.logos?.map((logo) => ({
    url: logo.url ?? "",
    mode: logo.mode,
    type: logo.type,
    colors: logo.colors?.map((color) => ({
      hex: color.hex ?? "",
      name: color.name,
    })),
    resolution:
      typeof logo.resolution?.width === "number" &&
      typeof logo.resolution.height === "number" &&
      typeof logo.resolution.aspect_ratio === "number"
        ? {
            width: logo.resolution.width,
            height: logo.resolution.height,
            aspect_ratio: logo.resolution.aspect_ratio,
          }
        : undefined,
  }));
  const backdrops = brand.backdrops?.map((backdrop) => ({
    url: backdrop.url ?? "",
    colors: backdrop.colors?.map((color) => ({
      hex: color.hex ?? "",
      name: color.name,
    })),
    resolution:
      typeof backdrop.resolution?.width === "number" &&
      typeof backdrop.resolution.height === "number" &&
      typeof backdrop.resolution.aspect_ratio === "number"
        ? {
            width: backdrop.resolution.width,
            height: backdrop.resolution.height,
            aspect_ratio: backdrop.resolution.aspect_ratio,
          }
        : undefined,
  }));

  return {
    domain: brand.domain ?? fallbackDomain ?? "",
    title: brand.title,
    description: brand.description,
    slogan: brand.slogan,
    logos,
    backdrops,
    colors,
  };
}

function emailDomain(email: string): string | undefined {
  const domain = email.trim().split("@")[1]?.trim().toLowerCase();
  return domain || undefined;
}

function isFreeOrDisposableEmailError(err: unknown): boolean {
  return (
    err instanceof ContextDevError &&
    err.status === 422 &&
    (err.code === "FREE_EMAIL_DETECTED" ||
      err.code === "DISPOSABLE_EMAIL_DETECTED")
  );
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

export async function retrieveBrand(
  domain: string,
  options?: { apiKey?: string | null },
): Promise<BrandData> {
  const res = await withContextDevErrors(() =>
    contextDevClient(options?.apiKey).brand.retrieve({ domain, maxAgeMs: 0 }),
  );
  return toBrandData(res.brand, domain);
}

/**
 * Retrieves brand assets from the signup email domain, or reports freemail/disposable (422).
 * Does not fall back to `CONTEXT_DEV_API_KEY` — callers must pass the submitted key.
 * @see https://docs.context.dev/api-reference/brand-intelligence/retrieve-brand-data-by-email-address.md
 */
export async function tryRetrieveBrandByEmail(
  email: string,
  bearerToken: string,
): Promise<
  { outcome: "brand"; brand: BrandData } | { outcome: "free_or_disposable" }
> {
  const key = bearerToken.trim();
  if (!key) {
    throw new ContextDevError("API key required", 400);
  }

  try {
    const res = await withContextDevErrors(() =>
      new ContextDev({ apiKey: key, maxRetries: 0 }).brand.retrieveByEmail({
        email: email.trim(),
        maxAgeMs: 0,
      }),
    );
    return {
      outcome: "brand",
      brand: toBrandData(res.brand, emailDomain(email)),
    };
  } catch (err) {
    if (isFreeOrDisposableEmailError(err)) {
      return { outcome: "free_or_disposable" };
    }
    throw err;
  }
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

function sanitizeBrandAssetUrl(raw: string | undefined | null): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (t.startsWith("https://") || t.startsWith("http://")) return t;
  return null;
}

function brandLogoHref(entry: BrandLogo | null | undefined): string | null {
  return sanitizeBrandAssetUrl(entry?.url ?? null);
}

export function pickBrandAssets(
  brand: BrandData | null | undefined,
  options?: {
    /** When true and no usable logo URLs exist, use the first backdrop (avatar-only fallback). */
    useBackdropWhenNoLogo?: boolean;
  },
): BrandAssets {
  if (!brand)
    return { title: null, description: null, logoUrl: null, backdropUrl: null };
  const logos = brand.logos ?? [];
  /** Dashboard avatar sits on neutral-950; dark / opaque logos read best there first. */
  const pickedLogo =
    logos.find(
      (l) => brandLogoHref(l) && l.type === "icon" && l.mode === "dark",
    ) ??
    logos.find(
      (l) =>
        brandLogoHref(l) &&
        l.type === "icon" &&
        l.mode === "has_opaque_background",
    ) ??
    logos.find(
      (l) => brandLogoHref(l) && l.type === "icon" && l.mode === "light",
    ) ??
    logos.find(
      (l) => brandLogoHref(l) && l.type === "icon" && l.mode !== "dark",
    ) ??
    logos.find((l) => brandLogoHref(l) && l.type === "icon") ??
    logos.find((l) => brandLogoHref(l) && l.mode !== "dark") ??
    logos.find((l) => brandLogoHref(l)) ??
    null;
  const backdrop =
    (brand.backdrops ?? []).find((b) => sanitizeBrandAssetUrl(b.url)) ??
    (brand.backdrops ?? [])[0] ??
    null;
  const backdropUrl = sanitizeBrandAssetUrl(backdrop?.url ?? null);
  let logoUrl = brandLogoHref(pickedLogo);
  if (!logoUrl && options?.useBackdropWhenNoLogo && backdropUrl)
    logoUrl = backdropUrl;
  return {
    title: brand.title?.trim() || null,
    description: brand.description?.trim() || null,
    logoUrl,
    backdropUrl,
  };
}

/**
 * Best image URL for the signed-in user's dashboard avatar (Context.dev CDN).
 * Returns null when the inbox is disposable/freemail (retrieve-by-email is unavailable).
 */
export async function resolveAccountBrandLogoUrl(
  sessionEmail: string | null | undefined,
  bearerToken: string,
): Promise<string | null> {
  const key = bearerToken.trim();
  if (!key) return null;
  const email = sessionEmail?.trim();
  if (!email) {
    await smokeVerifyContextApiKey(key);
    return null;
  }

  const byEmail = await tryRetrieveBrandByEmail(email, key);
  if (byEmail.outcome === "brand") {
    return pickBrandAssets(byEmail.brand, { useBackdropWhenNoLogo: true })
      .logoUrl;
  }
  await smokeVerifyContextApiKey(key);
  return null;
}
