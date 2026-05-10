import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

/* ------------------------------------------------------------------ */
/* BetterAuth core tables — field names follow the BetterAuth defaults. */
/* ------------------------------------------------------------------ */

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  /** Set when user finishes or defers Context.dev onboarding; null means gate /dashboard. */
  contextIntroDismissedAt: integer("contextIntroDismissedAt", { mode: "timestamp_ms" }),
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

/**
 * One row per user: shared secrets (Resend API key, context.dev) not tied to a single destination.
 */
export const userNotificationSettings = sqliteTable("userNotificationSettings", {
  userId: text("userId")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** Per-account key used only when CONTEXT_DEV_API_KEY is not configured on the server. */
  contextDevApiKey: text("contextDevApiKey"),
  /** Hotlinked brand icon URL from Context.dev (e.g. dashboard avatar). */
  accountBrandLogoUrl: text("accountBrandLogoUrl"),
  /** Per-account Resend API key used only when RESEND_API_KEY is not configured on the server. */
  resendApiKey: text("resendApiKey"),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/**
 * Named outbound integrations (Slack webhooks, email routes, generic JSON webhooks).
 */
export const notificationDestination = sqliteTable(
  "notificationDestination",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    channel: text("channel", { enum: ["SLACK", "EMAIL", "WEBHOOK"] }).notNull(),
    name: text("name").notNull(),
    slackWebhookUrl: text("slackWebhookUrl"),
    resendFromEmail: text("resendFromEmail"),
    resendToEmails: text("resendToEmails"),
    alertWebhookUrl: text("alertWebhookUrl"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    byUser: index("notification_destination_user_idx").on(t.userId),
  }),
);

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
    /** context.dev /web/screenshot public URL; preferred over `backdropUrl` for hero/cards. */
    heroScreenshotUrl: text("heroScreenshotUrl"),
    backdropUrl: text("backdropUrl"),
    /**
     * JSON string array of notificationDestination ids to notify; null/empty = all destinations.
     * Use `[]` to disable notifications for this site.
     */
    notificationDestinationIds: text("notificationDestinationIds"),
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
 *   SITEMAP_LINKS     — alert on sitemap URL changes (`linkScope` chooses new / removed / both).
 *   PAGE_CONTENT      — alert when a specific page's markdown changes
 *   PRODUCT_PRICE     — alert when a product page's price/currency changes (context.dev product API)
 */
export const target = sqliteTable(
  "target",
  {
    id: text("id").primaryKey(),
    websiteId: text("websiteId")
      .notNull()
      .references(() => website.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["SITEMAP_LINKS", "PAGE_CONTENT", "PRODUCT_PRICE"] }).notNull(),
    /** For SITEMAP_LINKS: which diffs notify. Null elsewhere. */
    linkScope: text("linkScope", { enum: ["NEW", "REMOVED", "BOTH"] }),
    /** For PAGE_CONTENT / PRODUCT_PRICE: the page URL. Null for sitemap-based targets. */
    pageUrl: text("pageUrl"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    /** Minimum spacing between successful checks (hours, fractional OK — e.g. 0.25 = 15m); worker wakes per SCRAPE_CRON. */
    checkIntervalHours: real("checkIntervalHours").notNull().default(1),
    /** Sole eligibility clock for scheduled runs; advanced by fixed interval after success. Null = due immediately. */
    nextCheckDueAt: integer("nextCheckDueAt", { mode: "timestamp_ms" }),
    lastCheckedAt: integer("lastCheckedAt", { mode: "timestamp_ms" }),
    /**
     * When false, alerts are stored only in-app — no Slack/email/webhook for this target.
     * When true, `notificationDestinationId` selects the target's external destination.
     */
    externalNotify: integer("externalNotify", { mode: "boolean" }).notNull().default(true),
    notificationDestinationId: text("notificationDestinationId").references(
      () => notificationDestination.id,
      { onDelete: "set null" },
    ),
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
 *  - kind=PRODUCT        payload = JSON of extracted product/price; targetUrl = product page URL
 */
export const snapshot = sqliteTable(
  "snapshot",
  {
    id: text("id").primaryKey(),
    websiteId: text("websiteId")
      .notNull()
      .references(() => website.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["SITEMAP", "MARKDOWN", "PRODUCT"] }).notNull(),
    /** For MARKDOWN / PRODUCT: the URL. Null for SITEMAP. */
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
    kind: text("kind", { enum: ["NEW_LINK", "REMOVED_LINK", "PAGE_CONTENT", "PRODUCT_PRICE"] }).notNull(),
    title: text("title").notNull(),
    /** JSON: link/content/product fields depending on kind */
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

/** Additional users invited to operate on rows keyed by ownerUserId (same as website.userId for that account). */
export const accountMembership = sqliteTable(
  "accountMembership",
  {
    ownerUserId: text("ownerUserId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    memberUserId: text("memberUserId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.ownerUserId, t.memberUserId] }),
    byMember: index("account_membership_member_idx").on(t.memberUserId),
  }),
);

/**
 * Multi-seat time-limited invite; store only tokenHash of the opaque token shown in URL.
 * `organizationLabel` is a snapshot for auth-page copy when the invite is opened without login.
 */
export const accountInvite = sqliteTable(
  "accountInvite",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("ownerUserId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tokenHash: text("tokenHash").notNull().unique(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    createdByUserId: text("createdByUserId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Display name copied at invite time (website title/name or profile name); never inferred from APIs here. */
    organizationLabel: text("organizationLabel"),
    maxUses: integer("maxUses").notNull().default(5),
    useCount: integer("useCount").notNull().default(0),
    redeemedAt: integer("redeemedAt", { mode: "timestamp_ms" }),
    redeemedByUserId: text("redeemedByUserId").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => ({
    byOwner: index("account_invite_owner_idx").on(t.ownerUserId),
    byExpires: index("account_invite_expires_idx").on(t.expiresAt),
  }),
);

export type User = typeof user.$inferSelect;
export type UserNotificationSettings = typeof userNotificationSettings.$inferSelect;
export type NotificationDestination = typeof notificationDestination.$inferSelect;
export type NotificationChannel = NotificationDestination["channel"];
export type Website = typeof website.$inferSelect;
export type Target = typeof target.$inferSelect;
export type Snapshot = typeof snapshot.$inferSelect;
export type Alert = typeof alert.$inferSelect;
export type AlertKind = Alert["kind"];
export type TargetKind = Target["kind"];
export type LinkScope = NonNullable<Target["linkScope"]>;
