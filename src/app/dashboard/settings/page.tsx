import { desc, eq } from "drizzle-orm";
import { AccountScopePrompt } from "@/components/account-scope-prompt";
import { SystemServicesSettings } from "@/components/system-services-settings";
import { NotificationChannelsSettings } from "@/components/notification-channels-settings";
import { TeamSettings } from "@/components/team-settings";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  canManageTeamInvites,
  getEffectiveAccountOwnerForWrites,
  loadAccountChoices,
} from "@/lib/effective-account";
import { requireUser } from "@/lib/session";
import {
  isAiModelManagedByEnv,
  isContextDevApiKeyManagedByEnv,
  isOpenAiApiKeyManagedByEnv,
  isResendApiKeyManagedByEnv,
  isResendSendFromEmailManagedByEnv,
  isVercelAiGatewayApiKeyManagedByEnv,
} from "@/lib/server-managed-config";
import { publicNotificationDestinations } from "@/lib/notification-destination-public";

export default async function SettingsPage() {
  const user = await requireUser();

  const scope = await getEffectiveAccountOwnerForWrites(user.id);
  if (!scope.ok) {
    const choices = await loadAccountChoices(user.id);
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Settings</h1>
          <p className="mt-2 text-sm text-neutral-600">Account and notification preferences.</p>
        </header>
        <div className="mt-8">
          <AccountScopePrompt choices={choices} />
        </div>
      </div>
    );
  }

  const ownerId = scope.ownerId;
  const teamManagement = canManageTeamInvites(user.id, ownerId);
  const contextDevApiKeyManaged = isContextDevApiKeyManagedByEnv();
  const resendApiKeyManaged = isResendApiKeyManagedByEnv();
  const resendSendFromEmailManaged = isResendSendFromEmailManagedByEnv();

  const [row] = await db
    .select({
      contextDevApiKey: schema.userNotificationSettings.contextDevApiKey,
      resendApiKey: schema.userNotificationSettings.resendApiKey,
      aiProvider: schema.userNotificationSettings.aiProvider,
      openaiApiKey: schema.userNotificationSettings.openaiApiKey,
      vercelAiGatewayApiKey: schema.userNotificationSettings.vercelAiGatewayApiKey,
      aiModel: schema.userNotificationSettings.aiModel,
    })
    .from(schema.userNotificationSettings)
    .where(eq(schema.userNotificationSettings.userId, ownerId))
    .limit(1);

  const destinations = await db
    .select()
    .from(schema.notificationDestination)
    .where(eq(schema.notificationDestination.userId, ownerId))
    .orderBy(desc(schema.notificationDestination.createdAt));
  const clientDestinations = publicNotificationDestinations(destinations);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Settings</h1>
        <p className="mt-1 text-sm text-neutral-600">Account and notification preferences.</p>
      </header>

      <section className="mt-8" aria-labelledby="notification-channels-heading">
        <h2 id="notification-channels-heading" className="text-sm font-medium text-neutral-900">
          Notification Channels
        </h2>
        <div className="mt-3">
          <NotificationChannelsSettings
            initialResendApiKey={resendApiKeyManaged ? null : row?.resendApiKey ?? null}
            initialDestinations={clientDestinations}
            resendApiKeyManaged={resendApiKeyManaged}
            resendSendFromEmailManaged={resendSendFromEmailManaged}
          />
        </div>
      </section>

      <SystemServicesSettings
        initialContextDevApiKey={contextDevApiKeyManaged ? null : row?.contextDevApiKey ?? null}
        contextDevApiKeyManaged={contextDevApiKeyManaged}
        initialOpenaiApiKey={isOpenAiApiKeyManagedByEnv() ? null : row?.openaiApiKey ?? null}
        initialVercelAiGatewayApiKey={
          isVercelAiGatewayApiKeyManagedByEnv() ? null : row?.vercelAiGatewayApiKey ?? null
        }
        initialAiProvider={row?.aiProvider ?? null}
        initialAiModel={isAiModelManagedByEnv() ? null : row?.aiModel ?? null}
        openaiApiKeyManaged={isOpenAiApiKeyManagedByEnv()}
        vercelAiGatewayApiKeyManaged={isVercelAiGatewayApiKeyManagedByEnv()}
        aiModelManaged={isAiModelManagedByEnv()}
      />

      {teamManagement && <TeamSettings />}
    </div>
  );
}
