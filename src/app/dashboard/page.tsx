import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { websiteOwnerAccessible } from "@/lib/account-access";
import { requireUser } from "@/lib/session";
import { WebsiteListView } from "@/components/website-list-view";
import { effectiveContextDevApiKey } from "@/lib/server-managed-config";
import { getStarterTemplatesWithLogos } from "@/lib/starter-template-logos.server";
import { STARTER_TEMPLATES } from "@/lib/starter-templates";

export default async function DashboardPage() {
  const user = await requireUser();

  // Correlated subqueries via Drizzle's `sql` template drop table qualifiers,
  // so outer-table column refs silently bind to the inner table. Use grouped
  // subqueries with LEFT JOINs instead.
  const targetStats = db
    .select({
      websiteId: schema.target.websiteId,
      targetCount: sql<number>`COUNT(*)::int`.as("targetCount"),
      lastCheckedAt: sql<number | null>`MAX(${schema.target.lastCheckedAt})`.as("lastCheckedAt"),
    })
    .from(schema.target)
    .groupBy(schema.target.websiteId)
    .as("target_stats");

  const alertStats = db
    .select({
      websiteId: schema.alert.websiteId,
      unreadAlerts: sql<number>`SUM(CASE WHEN ${schema.alert.read} = false THEN 1 ELSE 0 END)::int`.as("unreadAlerts"),
    })
    .from(schema.alert)
    .groupBy(schema.alert.websiteId)
    .as("alert_stats");

  const websites = await db
    .select({
      id: schema.website.id,
      name: schema.website.name,
      url: schema.website.url,
      domain: schema.website.domain,
      title: schema.website.title,
      description: schema.website.description,
      logoUrl: schema.website.logoUrl,
      heroScreenshotUrl: schema.website.heroScreenshotUrl,
      backdropUrl: schema.website.backdropUrl,
      createdAt: schema.website.createdAt,
      targetCount: sql<number>`COALESCE(${targetStats.targetCount}, 0)`,
      unreadAlerts: sql<number>`COALESCE(${alertStats.unreadAlerts}, 0)`,
      lastCheckedAt: targetStats.lastCheckedAt,
    })
    .from(schema.website)
    .leftJoin(targetStats, eq(targetStats.websiteId, schema.website.id))
    .leftJoin(alertStats, eq(alertStats.websiteId, schema.website.id))
    .where(websiteOwnerAccessible(user.id))
    .orderBy(desc(schema.website.createdAt));

  // Only pay for brand lookups on the empty state, where templates are shown.
  let templates = STARTER_TEMPLATES.map((t) => ({ ...t, logoUrl: null as string | null }));
  if (websites.length === 0) {
    const [settings] = await db
      .select({ contextDevApiKey: schema.userNotificationSettings.contextDevApiKey })
      .from(schema.userNotificationSettings)
      .where(eq(schema.userNotificationSettings.userId, user.id))
      .limit(1);
    const apiKey = effectiveContextDevApiKey(settings?.contextDevApiKey);
    templates = await getStarterTemplatesWithLogos(apiKey);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      <WebsiteListView websites={websites} templates={templates} />
    </div>
  );
}
