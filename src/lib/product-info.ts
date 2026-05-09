export const APP_NAME = "webdog.ai";
export const APP_SLUG = "webdog-ai";
export const WEBHOOK_EVENT_PREFIX = "webdog_ai";

export const NEW_ALERTS_EVENT_TYPE = `${WEBHOOK_EVENT_PREFIX}.new_alerts` as const;
export const TEST_EVENT_TYPE = `${WEBHOOK_EVENT_PREFIX}.test` as const;
export const WEBHOOK_USER_AGENT = `${APP_NAME}/1.0`;

export const DEFAULT_DATABASE_FILENAME = `${APP_SLUG}.db`;
export const DEFAULT_DATABASE_PATH = `./data/${DEFAULT_DATABASE_FILENAME}`;
export const RAILWAY_DATABASE_PATH = `/data/${DEFAULT_DATABASE_FILENAME}`;
