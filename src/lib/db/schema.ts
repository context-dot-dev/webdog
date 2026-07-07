import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* BetterAuth core tables — field names follow the BetterAuth defaults. */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  /** Set when user finishes or defers Context.dev onboarding; null means gate /dashboard. */
  contextIntroDismissedAt: timestamp("contextIntroDismissedAt", { withTimezone: true, precision: 3 }),
  createdAt: timestamp("createdAt", { withTimezone: true, precision: 3 }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, precision: 3 }).notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expiresAt", { withTimezone: true, precision: 3 }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt", { withTimezone: true, precision: 3 }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, precision: 3 }).notNull(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true, precision: 3 }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true, precision: 3 }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt", { withTimezone: true, precision: 3 }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, precision: 3 }).notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true, precision: 3 }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true, precision: 3 }),
  updatedAt: timestamp("updatedAt", { withTimezone: true, precision: 3 }),
});

/**
 * One row per user: shared secrets (Resend API key, context.dev) not tied to a single destination.
 */
export const userNotificationSettings = pgTable("userNotificationSettings", {
  userId: text("userId")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** Per-account key used only when CONTEXT_DEV_API_KEY is not configured on the server. */
  contextDevApiKey: text("contextDevApiKey"),
  /** Hotlinked brand icon URL from Context.dev (e.g. dashboard avatar). */
  accountBrandLogoUrl: text("accountBrandLogoUrl"),
  /** Per-account Resend API key used only when RESEND_API_KEY is not configured on the server. */
  resendApiKey: text("resendApiKey"),
  /** openai | vercel_gateway — which LLM endpoint to use for change summaries. */
  aiProvider: text("aiProvider", { enum: ["openai", "vercel_gateway"] }),
  /** Per-account OpenAI key when OPENAI_API_KEY is not configured on the server. */
  openaiApiKey: text("openaiApiKey"),
  /** Per-account Vercel AI Gateway key when AI_GATEWAY_API_KEY is not configured on the server. */
  vercelAiGatewayApiKey: text("vercelAiGatewayApiKey"),
  /** Model id for change summaries (e.g. gpt-5.4-nano or openai/gpt-5.4-nano). */
  aiModel: text("aiModel"),
  updatedAt: timestamp("updatedAt", { withTimezone: true, precision: 3 })
    .notNull()
    .defaultNow(),
});

/**
 * Named outbound integrations (Slack webhooks, email routes, generic JSON webhooks).
 */
export const notificationDestination = pgTable(
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
    createdAt: timestamp("createdAt", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byUser: index("notification_destination_user_idx").on(t.userId),
  }),
);

/* ------------------------------------------------------------------ */
/* Domain tables                                                      */
/* ------------------------------------------------------------------ */

export const website = pgTable(
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
    /** Unguessable token for a read-only public view; null = not shared. */
    publicShareToken: text("publicShareToken").unique(),
    createdAt: timestamp("createdAt", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
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
export const target = pgTable(
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
    /** Optional free-text note of what the user wants to watch for; labels the monitor and focuses AI summaries. */
    watchNote: text("watchNote"),
    enabled: boolean("enabled").notNull().default(true),
    /** Minimum spacing between successful checks (hours, fractional OK — e.g. 0.25 = 15m); worker wakes per SCRAPE_CRON. */
    checkIntervalHours: doublePrecision("checkIntervalHours").notNull().default(1),
    /** Sole eligibility clock for scheduled runs; advanced by fixed interval after success. Null = due immediately. */
    nextCheckDueAt: timestamp("nextCheckDueAt", { withTimezone: true, precision: 3 }),
    lastCheckedAt: timestamp("lastCheckedAt", { withTimezone: true, precision: 3 }),
    /** Human-readable message from the most recent failed check; null once a check succeeds. */
    lastError: text("lastError"),
    /** When the last failed check happened; null once a check succeeds. */
    lastErrorAt: timestamp("lastErrorAt", { withTimezone: true, precision: 3 }),
    /** context.dev CDN screenshot URL of the watched page from the most recent check. */
    lastScreenshotUrl: text("lastScreenshotUrl"),
    /** When the stored screenshot was captured. */
    lastScreenshotAt: timestamp("lastScreenshotAt", { withTimezone: true, precision: 3 }),
    /**
     * When false, alerts are stored only in-app — no Slack/email/webhook for this target.
     * When true, `notificationDestinationId` selects the target's external destination.
     */
    externalNotify: boolean("externalNotify").notNull().default(true),
    notificationDestinationId: text("notificationDestinationId").references(
      () => notificationDestination.id,
      { onDelete: "set null" },
    ),
    /** When true, new alerts for this target get an LLM-generated plain-language summary. */
    aiChangeSummaryEnabled: boolean("aiChangeSummaryEnabled").notNull().default(false),
    createdAt: timestamp("createdAt", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
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
export const snapshot = pgTable(
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
    createdAt: timestamp("createdAt", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byLookup: index("snapshot_lookup_idx").on(t.websiteId, t.kind, t.targetUrl, t.createdAt),
  }),
);

export const alert = pgTable(
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
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("createdAt", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byWebsite: index("alert_website_idx").on(t.websiteId, t.createdAt),
    byTarget: index("alert_target_idx").on(t.targetId),
  }),
);

/** Additional users invited to operate on rows keyed by ownerUserId (same as website.userId for that account). */
export const accountMembership = pgTable(
  "accountMembership",
  {
    ownerUserId: text("ownerUserId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    memberUserId: text("memberUserId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
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
export const accountInvite = pgTable(
  "accountInvite",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("ownerUserId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tokenHash: text("tokenHash").notNull().unique(),
    expiresAt: timestamp("expiresAt", { withTimezone: true, precision: 3 }).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true, precision: 3 })
      .notNull()
      .defaultNow(),
    createdByUserId: text("createdByUserId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Display name copied at invite time (website title/name or profile name); never inferred from APIs here. */
    organizationLabel: text("organizationLabel"),
    maxUses: integer("maxUses").notNull().default(5),
    useCount: integer("useCount").notNull().default(0),
    redeemedAt: timestamp("redeemedAt", { withTimezone: true, precision: 3 }),
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
export type AiProvider = NonNullable<UserNotificationSettings["aiProvider"]>;
