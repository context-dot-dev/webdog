import { stripAlertPostfixText } from "./alert-postfix";

if (typeof window !== "undefined") {
  throw new Error("server-managed config must not be imported in the browser");
}

function readEnvValue(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

function readNonNegativeInteger(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return null;
  return parsed;
}

export function serverContextDevApiKey(): string | null {
  return readEnvValue("CONTEXT_DEV_API_KEY", "context_dev_api_key");
}

export function isContextDevApiKeyManagedByEnv(): boolean {
  return serverContextDevApiKey() !== null;
}

export function effectiveContextDevApiKey(accountKey?: string | null): string | null {
  return serverContextDevApiKey() ?? accountKey?.trim() ?? null;
}

export function serverResendApiKey(): string | null {
  return readEnvValue("RESEND_API_KEY");
}

export function isResendApiKeyManagedByEnv(): boolean {
  return serverResendApiKey() !== null;
}

export function effectiveResendApiKey(accountKey?: string | null): string | null {
  return serverResendApiKey() ?? accountKey?.trim() ?? null;
}

export function serverResendSendFromEmail(): string | null {
  return readEnvValue("RESEND_SEND_FROM_EMAIL");
}

export function isResendSendFromEmailManagedByEnv(): boolean {
  return serverResendSendFromEmail() !== null;
}

export function effectiveResendSendFromEmail(destinationFrom?: string | null): string | null {
  return serverResendSendFromEmail() ?? destinationFrom?.trim() ?? null;
}

export function alertPostfix(): string | null {
  return readEnvValue("POSTFIX_TO_ALERTS");
}

export function appendAlertPostfix(text: string): string {
  const postfix = alertPostfix();
  if (!postfix) return text;
  const trimmedText = text.trimEnd();
  if (trimmedText.endsWith(postfix)) return trimmedText;
  return `${trimmedText} ${postfix}`;
}

/** Remove deployment postfix from stored alert titles (legacy rows). */
export function stripAlertPostfix(text: string): string {
  return stripAlertPostfixText(text, alertPostfix());
}

export function maxAlertsPerAccount(): number | null {
  return readNonNegativeInteger("MAX_ALERTS");
}

export function serverOpenAiApiKey(): string | null {
  return readEnvValue("OPENAI_API_KEY");
}

export function isOpenAiApiKeyManagedByEnv(): boolean {
  return serverOpenAiApiKey() !== null;
}

export function effectiveOpenAiApiKey(accountKey?: string | null): string | null {
  return serverOpenAiApiKey() ?? accountKey?.trim() ?? null;
}

export function serverVercelAiGatewayApiKey(): string | null {
  return readEnvValue("AI_GATEWAY_API_KEY", "VERCEL_AI_GATEWAY_API_KEY");
}

export function isVercelAiGatewayApiKeyManagedByEnv(): boolean {
  return serverVercelAiGatewayApiKey() !== null;
}

export function effectiveVercelAiGatewayApiKey(accountKey?: string | null): string | null {
  return serverVercelAiGatewayApiKey() ?? accountKey?.trim() ?? null;
}

export function serverAiModel(): string | null {
  return readEnvValue("AI_MODEL");
}

export function isAiModelManagedByEnv(): boolean {
  return serverAiModel() !== null;
}

export function effectiveAiModel(accountModel?: string | null): string | null {
  return serverAiModel() ?? accountModel?.trim() ?? null;
}
