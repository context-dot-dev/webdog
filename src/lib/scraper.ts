/**
 * Per-website scrape + diff pipeline. The worker calls `runWebsiteChecks(websiteId)`
 * on a schedule; this module is also used by the manual-trigger API route.
 */

import { createHash } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import * as schema from "./db/schema";
import { scrapeMarkdown, scrapeSitemap, parseDomain } from "./context-client";
import { newId } from "./ids";
import type { Target, TargetKind } from "./db/schema";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

async function latestSnapshot(websiteId: string, kind: "SITEMAP" | "MARKDOWN", targetUrl: string | null) {
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

function diffPreview(before: string, after: string, ctxLines = 3): string {
  const a = before.split("\n");
  const b = after.split("\n");
  const setA = new Set(a);
  const setB = new Set(b);
  const added = b.filter((l) => !setA.has(l));
  const removed = a.filter((l) => !setB.has(l));
  const limit = (arr: string[]) => arr.slice(0, ctxLines).map((l) => l.length > 160 ? l.slice(0, 157) + "…" : l);
  const parts: string[] = [];
  if (added.length) parts.push(`+ ${limit(added).join("\n+ ")}`);
  if (removed.length) parts.push(`- ${limit(removed).join("\n- ")}`);
  return parts.join("\n");
}

interface SiteScrapeCache {
  sitemap?: { urls: string[]; hash: string };
  markdown: Map<string, { md: string; hash: string }>;
}

async function ensureSitemap(website: { id: string; url: string; domain: string }, cache: SiteScrapeCache) {
  if (cache.sitemap) return cache.sitemap;
  const result = await scrapeSitemap(website.domain);
  const urls = [...result.urls].sort();
  cache.sitemap = { urls, hash: sha256(urls.join("\n")) };
  return cache.sitemap;
}

async function ensureMarkdown(pageUrl: string, cache: SiteScrapeCache) {
  const cached = cache.markdown.get(pageUrl);
  if (cached) return cached;
  const result = await scrapeMarkdown(pageUrl, { useMainContentOnly: true });
  const md = result.markdown ?? "";
  const value = { md, hash: sha256(md) };
  cache.markdown.set(pageUrl, value);
  return value;
}

interface AlertInsert {
  id: string;
  websiteId: string;
  targetId: string;
  kind: TargetKind;
  title: string;
  details: string;
  createdAt: Date;
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
  if (target.kind === "NEW_LINK" && added.length > 0 && prev) {
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
  if (target.kind === "REMOVED_LINK" && removed.length > 0 && prev) {
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
      alerts.push({
        id: newId("alt"),
        websiteId: website.id,
        targetId: target.id,
        kind: "PAGE_CONTENT",
        title: `Content changed on ${page}`,
        details: JSON.stringify({ pageUrl: page, diffPreview: diffPreview(prev.payload, curr.md) }),
        createdAt: new Date(),
      });
    }
  } catch (err) {
    console.error(`scrape markdown failed for ${page}:`, err);
  }
}

/**
 * Run all enabled targets for a single website. Writes new snapshots and
 * alert rows as side effects.
 */
export async function runWebsiteChecks(websiteId: string): Promise<{ alerts: number; errors: number }> {
  const [website] = await db.select().from(schema.website).where(eq(schema.website.id, websiteId)).limit(1);
  if (!website) throw new Error(`website ${websiteId} not found`);

  const targets = await db
    .select()
    .from(schema.target)
    .where(and(eq(schema.target.websiteId, websiteId), eq(schema.target.enabled, true)));

  const cache: SiteScrapeCache = { markdown: new Map() };
  const alerts: AlertInsert[] = [];
  let errors = 0;

  for (const t of targets) {
    try {
      if (t.kind === "NEW_LINK" || t.kind === "REMOVED_LINK") {
        await handleLinkTarget(website, t, cache, alerts);
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

  const now = new Date();
  if (cache.sitemap) {
    await db.insert(schema.snapshot).values({
      id: newId("snp"),
      websiteId: website.id,
      kind: "SITEMAP",
      targetUrl: null,
      payload: JSON.stringify(cache.sitemap.urls),
      hash: cache.sitemap.hash,
      createdAt: now,
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
      createdAt: now,
    });
  }

  if (alerts.length > 0) {
    await db.insert(schema.alert).values(alerts);
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
