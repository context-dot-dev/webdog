import { desc, eq } from "drizzle-orm";
import { ContextDevSettings } from "@/components/context-dev-settings";
import { NotificationChannelsSettings } from "@/components/notification-channels-settings";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireUser } from "@/lib/session";

export default async function SettingsPage() {
  const user = await requireUser();

  const [row] = await db
    .select({
      contextDevApiKey: schema.userNotificationSettings.contextDevApiKey,
      resendApiKey: schema.userNotificationSettings.resendApiKey,
    })
    .from(schema.userNotificationSettings)
    .where(eq(schema.userNotificationSettings.userId, user.id))
    .limit(1);

  const destinations = await db
    .select()
    .from(schema.notificationDestination)
    .where(eq(schema.notificationDestination.userId, user.id))
    .orderBy(desc(schema.notificationDestination.createdAt));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Settings</h1>
        <p className="mt-1 text-sm text-neutral-600">Account and notification preferences.</p>
      </header>

      <section className="mt-8" aria-labelledby="notification-channels-heading">
        <h2 id="notification-channels-heading" className="text-sm font-medium text-neutral-900">
          Notification Channels
        </h2>
        <div className="mt-3">
          <NotificationChannelsSettings
            initialResendApiKey={row?.resendApiKey ?? null}
            initialDestinations={destinations}
          />
        </div>
      </section>

      <ContextDevSettings initialContextDevApiKey={row?.contextDevApiKey ?? null} />
    </div>
  );
}
