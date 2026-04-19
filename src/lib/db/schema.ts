import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

/* ------------------------------------------------------------------ */
/* BetterAuth core tables — field names follow the BetterAuth defaults. */
/* ------------------------------------------------------------------ */

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp_ms" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp_ms" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }),
});

/* ------------------------------------------------------------------ */
/* Domain tables                                                      */
/* ------------------------------------------------------------------ */

export const website = sqliteTable(
  "website",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    domain: text("domain").notNull(),
    title: text("title"),
    description: text("description"),
    logoUrl: text("logoUrl"),
    backdropUrl: text("backdropUrl"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    byUser: index("website_user_idx").on(t.userId),
  }),
);

/**
 * Target types:
 *   NEW_LINK          — alert when the sitemap gains URLs
 *   REMOVED_LINK      — alert when the sitemap loses URLs
 *   PAGE_CONTENT      — alert when a specific page's markdown changes
 */
export const target = sqliteTable(
  "target",
  {
    id: text("id").primaryKey(),
    websiteId: text("websiteId")
      .notNull()
      .references(() => website.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["NEW_LINK", "REMOVED_LINK", "PAGE_CONTENT"] }).notNull(),
    /** For PAGE_CONTENT: the specific page URL to watch. Null otherwise. */
    pageUrl: text("pageUrl"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    lastCheckedAt: integer("lastCheckedAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    byWebsite: index("target_website_idx").on(t.websiteId),
  }),
);

/**
 * Snapshots store the raw scrape result at a point in time. The worker
 * compares the latest snapshot against the previous one to generate alerts.
 *
 *  - kind=SITEMAP         payload = JSON string array of URLs
 *  - kind=MARKDOWN        payload = markdown body; targetUrl set
 */
export const snapshot = sqliteTable(
  "snapshot",
  {
    id: text("id").primaryKey(),
    websiteId: text("websiteId")
      .notNull()
      .references(() => website.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["SITEMAP", "MARKDOWN"] }).notNull(),
    /** For MARKDOWN: the URL that was scraped. Null for SITEMAP. */
    targetUrl: text("targetUrl"),
    payload: text("payload").notNull(),
    /** sha256 of payload — cheap equality checks. */
    hash: text("hash").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    byLookup: index("snapshot_lookup_idx").on(t.websiteId, t.kind, t.targetUrl, t.createdAt),
  }),
);

export const alert = sqliteTable(
  "alert",
  {
    id: text("id").primaryKey(),
    websiteId: text("websiteId")
      .notNull()
      .references(() => website.id, { onDelete: "cascade" }),
    targetId: text("targetId")
      .notNull()
      .references(() => target.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["NEW_LINK", "REMOVED_LINK", "PAGE_CONTENT"] }).notNull(),
    title: text("title").notNull(),
    /** JSON blob: { added?: string[]; removed?: string[]; pageUrl?: string; diffPreview?: string } */
    details: text("details").notNull(),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    byWebsite: index("alert_website_idx").on(t.websiteId, t.createdAt),
    byTarget: index("alert_target_idx").on(t.targetId),
  }),
);

export type User = typeof user.$inferSelect;
export type Website = typeof website.$inferSelect;
export type Target = typeof target.$inferSelect;
export type Snapshot = typeof snapshot.$inferSelect;
export type Alert = typeof alert.$inferSelect;
export type TargetKind = Target["kind"];
