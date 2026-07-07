import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { websiteOwnerAccessible } from "@/lib/account-access";
import { getEffectiveAccountOwnerForWrites, loadAccountChoices } from "@/lib/effective-account";
import { APP_NAME } from "@/lib/product-info";
import { requireUser } from "@/lib/session";
import { isContextDevApiKeyManagedByEnv } from "@/lib/server-managed-config";
import { AccountSwitcher } from "@/components/account-switcher";
import { MobileNav } from "@/components/mobile-nav";
import { TopNav } from "@/components/top-nav";
import { HeaderUserMenu } from "@/components/header-user-menu";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const logoScope = await getEffectiveAccountOwnerForWrites(user.id);
  const logoOwnerId = logoScope.ok ? logoScope.ownerId : user.id;
  const accountChoices = await loadAccountChoices(user.id);

  const [profile] = await db
    .select({
      dismissed: schema.user.contextIntroDismissedAt,
    })
    .from(schema.user)
    .where(eq(schema.user.id, user.id))
    .limit(1);

  const [logoRow] = await db
    .select({
      avatarLogoUrl: schema.userNotificationSettings.accountBrandLogoUrl,
    })
    .from(schema.userNotificationSettings)
    .where(eq(schema.userNotificationSettings.userId, logoOwnerId))
    .limit(1);

  if (!profile?.dismissed && !isContextDevApiKeyManagedByEnv()) {
    redirect("/onboarding/context-dev");
  }

  const [unreadRow] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.alert)
    .innerJoin(schema.website, eq(schema.website.id, schema.alert.websiteId))
    .where(and(websiteOwnerAccessible(user.id), eq(schema.alert.read, false)));

  const unreadAlertCount = unreadRow?.n ?? 0;

  return (
    <div className="relative isolate min-h-dvh overflow-x-hidden bg-cream-100 antialiased">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 size-[480px] rounded-full bg-peach opacity-50 blur-3xl" />
        <div className="absolute top-20 -right-40 size-[420px] rounded-full bg-mint opacity-40 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 bg-cream-100/80 backdrop-blur supports-[backdrop-filter]:bg-cream-100/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            aria-label={`${APP_NAME} home`}
            className="flex shrink-0 items-center gap-2.5"
          >
            <span className="grid size-9 place-items-center rounded-2xl bg-neutral-900 text-xl text-cream-100">
              🐶
            </span>
            <span className="hidden font-semibold tracking-tight text-neutral-900 sm:inline">
              {APP_NAME}
            </span>
          </Link>
          <span aria-hidden className="hidden h-5 w-px bg-neutral-900/10 lg:inline-block" />
          <TopNav className="hidden lg:flex" unreadAlertCount={unreadAlertCount} />
          <AccountSwitcher
            className="hidden lg:flex"
            choices={accountChoices}
            activeOwnerId={logoScope.ok ? logoScope.ownerId : undefined}
          />
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden lg:block">
              <HeaderUserMenu
                user={{ name: user.name, email: user.email }}
                avatarLogoUrl={logoRow?.avatarLogoUrl ?? user.image ?? null}
              />
            </div>
            <div className="lg:hidden">
              <MobileNav
                user={{ name: user.name, email: user.email }}
                avatarLogoUrl={logoRow?.avatarLogoUrl ?? user.image ?? null}
                unreadAlertCount={unreadAlertCount}
                accountChoices={accountChoices}
                activeAccountOwnerId={logoScope.ok ? logoScope.ownerId : undefined}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="relative min-w-0">{children}</main>

      <a
        href="https://context.dev"
        target="_blank"
        rel="noreferrer noopener"
        aria-label="Built using Context.dev"
        className="fixed bottom-3 right-3 z-30 opacity-90 transition-opacity hover:opacity-100 sm:bottom-4 sm:right-4"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fortunecookie.png"
          alt="Built using Context.dev"
          className="w-40 drop-shadow-md sm:w-52"
        />
      </a>
    </div>
  );
}
