/**
 * Per-website scrape + diff pipeline. The worker calls `runWebsiteChecks(websiteId)`
 * on a schedule; this module is also used by the manual-trigger API route.
 */

import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "./db";
import * as schema from "./db/schema";
import { extractProduct, scrapeMarkdown, scrapeSitemap, parseDomain } from "./context-client";
import { newId } from "./ids";
import type { AlertKind, NotificationChannel, Target } from "./db/schema";
import { dispatchNewAlertsForDestinations } from "./dispatch-new-alerts";
import { resolveDestinationsForTarget } from "./website-notification-destinations";
import { buildNewAlertsPayload, type NewAlertsAlert } from "./notification-new-alerts";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

type SnapshotKind = "SITEMAP" | "MARKDOWN" | "PRODUCT";

async function latestSnapshot(websiteId: string, kind: SnapshotKind, targetUrl: string | null) {
  const rows = await db
    .select()
    .from(schema.snapshot)
    .where(
      and(
        eq(schema.snapshot.websiteId, websiteId),
        eq(schema.snapshot.kind, kind),
        targetUrl === null ? isNull(schema.snapshot.targetUrl) : eq(schema.snapshot.targetUrl, targetUrl),
      ),
    )
    .orderBy(desc(schema.snapshot.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export function diffPreview(
  before: string,
  after: string,
  ctxLines = 3,
): { preview: string; totalAdded: number; totalRemoved: number } {
  const a = before.split("\n");
  const b = after.split("\n");
  const setA = new Set(a);
  const setB = new Set(b);
  const added = b.filter((l) => !setA.has(l));
  const removed = a.filter((l) => !setB.has(l));
  const limit = (arr: string[]) =>
    arr.slice(0, ctxLines).map((l) => (l.length > 160 ? l.slice(0, 157) + "…" : l));
  const parts: string[] = [];
  if (added.length) parts.push(`+ ${limit(added).join("\n+ ")}`);
  if (removed.length) parts.push(`- ${limit(removed).join("\n- ")}`);
  return { preview: parts.join("\n"), totalAdded: added.length, totalRemoved: removed.length };
}

interface ProductSnapshotData {
  is_product_page: boolean;
  platform: string | null;
  productName: string | null;
  price: number | null;
  currency: string | null;
}

function priceChangeKey(p: { price: number | null; currency: string | null }): string {
  const c = p.currency ?? "";
  if (p.price === null || p.price === undefined) return `${c}\t`;
  return `${c}\t${p.price}`;
}

interface SiteScrapeCache {
  sitemap?: { urls: string[]; hash: string };
  markdown: Map<string, { md: string; hash: string }>;
  product: Map<string, { payload: string; hash: string }>;
  /** Per-user context.dev key; null = use env only. */
  contextApiKey: string | null;
}

async function ensureSitemap(website: { id: string; url: string; domain: string }, cache: SiteScrapeCache) {
  if (cache.sitemap) return cache.sitemap;
  const result = await scrapeSitemap(website.domain, { apiKey: cache.contextApiKey });
  const urls = [...result.urls].sort();
  cache.sitemap = { urls, hash: sha256(urls.join("\n")) };
  return cache.sitemap;
}

async function ensureMarkdown(pageUrl: string, cache: SiteScrapeCache) {
  const cached = cache.markdown.get(pageUrl);
  if (cached) return cached;
  const result = await scrapeMarkdown(pageUrl, { useMainContentOnly: true, apiKey: cache.contextApiKey });
  const md = result.markdown ?? "";
  const value = { md, hash: sha256(md) };
  cache.markdown.set(pageUrl, value);
  return value;
}

interface AlertInsert {
  id: string;
  websiteId: string;
  targetId: string;
  kind: AlertKind;
  title: string;
  details: string;
  createdAt: Date;
}

function linkScopeEmits(scope: string | null | undefined, variant: "new" | "removed"): boolean {
  const s = scope ?? "BOTH";
  if (s === "BOTH") return true;
  if (variant === "new") return s === "NEW";
  return s === "REMOVED";
}

async function handleLinkTarget(
  website: { id: string; url: string; domain: string },
  target: Target,
  cache: SiteScrapeCache,
  alerts: AlertInsert[],
): Promise<void> {
  const current = await ensureSitemap(website, cache);
  const prev = await latestSnapshot(website.id, "SITEMAP", null);
  const prevUrls: string[] = prev ? (JSON.parse(prev.payload) as string[]) : [];

  const prevSet = new Set(prevUrls);
  const currSet = new Set(current.urls);
  const added = current.urls.filter((u) => !prevSet.has(u));
  const removed = prevUrls.filter((u) => !currSet.has(u));

  const now = new Date();
  const scope = target.linkScope;
  if (linkScopeEmits(scope, "new") && added.length > 0 && prev) {
    alerts.push({
      id: newId("alt"),
      websiteId: website.id,
      targetId: target.id,
      kind: "NEW_LINK",
      title: `${added.length} new link${added.length === 1 ? "" : "s"} on ${website.domain}`,
      details: JSON.stringify({ added: added.slice(0, 100) }),
      createdAt: now,
    });
  }
  if (linkScopeEmits(scope, "removed") && removed.length > 0 && prev) {
    alerts.push({
      id: newId("alt"),
      websiteId: website.id,
      targetId: target.id,
      kind: "REMOVED_LINK",
      title: `${removed.length} link${removed.length === 1 ? "" : "s"} removed from ${website.domain}`,
      details: JSON.stringify({ removed: removed.slice(0, 100) }),
      createdAt: now,
    });
  }
}

async function handleContentTarget(
  website: { id: string; url: string; domain: string },
  target: Target,
  cache: SiteScrapeCache,
  alerts: AlertInsert[],
): Promise<void> {
  if (!target.pageUrl) return;
  const page = target.pageUrl;
  try {
    const curr = await ensureMarkdown(page, cache);
    const prev = await latestSnapshot(website.id, "MARKDOWN", page);
    if (prev && prev.hash !== curr.hash) {
      const { preview, totalAdded, totalRemoved } = diffPreview(prev.payload, curr.md);
      alerts.push({
        id: newId("alt"),
        websiteId: website.id,
        targetId: target.id,
        kind: "PAGE_CONTENT",
        title: `Content changed on ${page}`,
        details: JSON.stringify({ pageUrl: page, diffPreview: preview, totalAdded, totalRemoved }),
        createdAt: new Date(),
      });
    }
  } catch (err) {
    console.error(`scrape markdown failed for ${page}:`, err);
  }
}

async function handleProductPriceTarget(
  website: { id: string; url: string; domain: string },
  target: Target,
  cache: SiteScrapeCache,
  alerts: AlertInsert[],
): Promise<void> {
  if (!target.pageUrl) return;
  const page = target.pageUrl;
  try {
    const result = await extractProduct(page, { apiKey: cache.contextApiKey });
    const snap: ProductSnapshotData = {
      is_product_page: result.is_product_page,
      platform: result.platform ?? null,
      productName: result.product?.name ?? null,
      price: result.product?.price ?? null,
      currency: result.product?.currency ?? null,
    };
    const payload = JSON.stringify(snap);
    const value = { payload, hash: sha256(payload) };
    cache.product.set(page, value);

    const prev = await latestSnapshot(website.id, "PRODUCT", page);
    if (!prev) return;
    if (!snap.is_product_page) return;
    const prevData = JSON.parse(prev.payload) as ProductSnapshotData;
    if (!prevData.is_product_page) return;
    if (priceChangeKey(prevData) === priceChangeKey(snap)) return;

    const name = snap.productName || page;
    const fmt = (p: number | null, c: string | null) =>
      p === null || p === undefined ? "—" : `${c ? `${c} ` : ""}${p}`.trim();
    alerts.push({
      id: newId("alt"),
      websiteId: website.id,
      targetId: target.id,
      kind: "PRODUCT_PRICE",
      title: `Price change: ${name} (${fmt(prevData.price, prevData.currency)} → ${fmt(snap.price, snap.currency)})`,
      details: JSON.stringify({
        pageUrl: page,
        productName: snap.productName,
        previousPrice: prevData.price,
        previousCurrency: prevData.currency,
        newPrice: snap.price,
        newCurrency: snap.currency,
      }),
      createdAt: new Date(),
    });
  } catch (err) {
    console.error(`extract product failed for ${page}:`, err);
  }
}

export type RunWebsiteChecksOptions = {
  /** When true (e.g. manual "Run now"), every enabled target runs regardless of schedule. */
  force?: boolean;
  /** When set, only this target is checked (manual); ignores schedule and enabled flag. */
  targetId?: string;
};

/**
 * Run all enabled targets for a single website. Writes new snapshots and
 * alert rows as side effects.
 */
export async function runWebsiteChecks(
  websiteId: string,
  options?: RunWebsiteChecksOptions,
): Promise<{ alerts: number; errors: number }> {
  const [website] = await db.select().from(schema.website).where(eq(schema.website.id, websiteId)).limit(1);
  if (!website) throw new Error(`website ${websiteId} not found`);

  const [userSettings] = await db
    .select({
      contextDevApiKey: schema.userNotificationSettings.contextDevApiKey,
      resendApiKey: schema.userNotificationSettings.resendApiKey,
    })
    .from(schema.userNotificationSettings)
    .where(eq(schema.userNotificationSettings.userId, website.userId))
    .limit(1);

  const userDestinations = await db
    .select({
      id: schema.notificationDestination.id,
      channel: schema.notificationDestination.channel,
      slackWebhookUrl: schema.notificationDestination.slackWebhookUrl,
      resendFromEmail: schema.notificationDestination.resendFromEmail,
      resendToEmails: schema.notificationDestination.resendToEmails,
      alertWebhookUrl: schema.notificationDestination.alertWebhookUrl,
    })
    .from(schema.notificationDestination)
    .where(eq(schema.notificationDestination.userId, website.userId));

  const contextApiKey = userSettings?.contextDevApiKey?.trim() || null;

  const targets = options?.targetId
    ? await db
        .select()
        .from(schema.target)
        .where(and(eq(schema.target.websiteId, websiteId), eq(schema.target.id, options.targetId)))
        .limit(1)
    : await db
        .select()
        .from(schema.target)
        .where(and(eq(schema.target.websiteId, websiteId), eq(schema.target.enabled, true)));

  const cache: SiteScrapeCache = { markdown: new Map(), product: new Map(), contextApiKey };
  const alerts: AlertInsert[] = [];
  let errors = 0;

  const singleTarget = Boolean(options?.targetId);

  for (const t of targets) {
    if (!singleTarget && !options?.force) {
      const hours = t.checkIntervalHours ?? 1;
      const intervalMs = hours * 60 * 60 * 1000;
      const isDue = !t.lastCheckedAt || Date.now() - Number(t.lastCheckedAt) >= intervalMs;
      if (!isDue) continue;
    }
    try {
      if (t.kind === "SITEMAP_LINKS") {
        await handleLinkTarget(website, t, cache, alerts);
      } else if (t.kind === "PRODUCT_PRICE") {
        await handleProductPriceTarget(website, t, cache, alerts);
      } else {
        await handleContentTarget(website, t, cache, alerts);
      }
      await db
        .update(schema.target)
        .set({ lastCheckedAt: new Date() })
        .where(eq(schema.target.id, t.id));
    } catch (err) {
      errors += 1;
      console.error(`target ${t.id} (${t.kind}) failed:`, err);
    }
  }

  if (cache.sitemap) {
    await db.insert(schema.snapshot).values({
      id: newId("snp"),
      websiteId: website.id,
      kind: "SITEMAP",
      targetUrl: null,
      payload: JSON.stringify(cache.sitemap.urls),
      hash: cache.sitemap.hash,
      createdAt: new Date(),
    });
  }
  for (const [url, md] of cache.markdown.entries()) {
    await db.insert(schema.snapshot).values({
      id: newId("snp"),
      websiteId: website.id,
      kind: "MARKDOWN",
      targetUrl: url,
      payload: md.md,
      hash: md.hash,
      createdAt: new Date(),
    });
  }
  for (const [url, p] of cache.product.entries()) {
    await db.insert(schema.snapshot).values({
      id: newId("snp"),
      websiteId: website.id,
      kind: "PRODUCT",
      targetUrl: url,
      payload: p.payload,
      hash: p.hash,
      createdAt: new Date(),
    });
  }

  if (alerts.length > 0) {
    await db.insert(schema.alert).values(alerts);

    const targetIdList = [...new Set(alerts.map((a) => a.targetId))];
    const targetRows = await db
      .select()
      .from(schema.target)
      .where(inArray(schema.target.id, targetIdList));
    const targetById = new Map(targetRows.map((t) => [t.id, t]));

    const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    const siteInfo = { id: website.id, name: website.name, domain: website.domain };

    const alertsByDestinationId = new Map<string, NewAlertsAlert[]>();
    for (const a of alerts) {
      const tgt = targetById.get(a.targetId);
      if (!tgt) continue;
      const dests = resolveDestinationsForTarget(tgt, userDestinations, website.notificationDestinationIds);
      let parsedDetails: { diffPreview?: string; totalAdded?: number; totalRemoved?: number } = {};
      try {
        parsedDetails = JSON.parse(a.details) as typeof parsedDetails;
      } catch {
        // ignore malformed details
      }
      const alertEntry: NewAlertsAlert = {
        id: a.id,
        title: a.title,
        diffPreview: parsedDetails.diffPreview,
        totalAdded: parsedDetails.totalAdded,
        totalRemoved: parsedDetails.totalRemoved,
      };
      for (const d of dests) {
        const list = alertsByDestinationId.get(d.id) ?? [];
        list.push(alertEntry);
        alertsByDestinationId.set(d.id, list);
      }
    }

    for (const [destId, alertEntries] of alertsByDestinationId) {
      const row = userDestinations.find((d) => d.id === destId);
      if (!row) continue;
      const payload = buildNewAlertsPayload(base, siteInfo, alertEntries);
      await dispatchNewAlertsForDestinations(
        [
          {
            channel: row.channel as NotificationChannel,
            slackWebhookUrl: row.slackWebhookUrl,
            resendFromEmail: row.resendFromEmail,
            resendToEmails: row.resendToEmails,
            alertWebhookUrl: row.alertWebhookUrl,
          },
        ],
        userSettings?.resendApiKey,
        payload,
      );
    }
  }

  return { alerts: alerts.length, errors };
}

export async function runAllChecks(): Promise<{ websites: number; alerts: number; errors: number }> {
  const websites = await db.select({ id: schema.website.id }).from(schema.website);
  let alerts = 0;
  let errors = 0;
  for (const w of websites) {
    try {
      const res = await runWebsiteChecks(w.id);
      alerts += res.alerts;
      errors += res.errors;
    } catch (err) {
      errors += 1;
      console.error(`website ${w.id} check failed:`, err);
    }
  }
  return { websites: websites.length, alerts, errors };
}

export { parseDomain };
