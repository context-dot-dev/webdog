import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireUser } from "@/lib/session";
import { LogoMark } from "@/components/logo";
import { MobileNav } from "@/components/mobile-nav";
import { TopNav } from "@/components/top-nav";
import { HeaderUserMenu } from "@/components/header-user-menu";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const [profile] = await db
    .select({
      dismissed: schema.user.contextIntroDismissedAt,
      avatarLogoUrl: schema.userNotificationSettings.accountBrandLogoUrl,
    })
    .from(schema.user)
    .leftJoin(
      schema.userNotificationSettings,
      eq(schema.userNotificationSettings.userId, schema.user.id),
    )
    .where(eq(schema.user.id, user.id))
    .limit(1);

  if (!profile?.dismissed) {
    redirect("/onboarding/context-dev");
  }

  const [unreadRow] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.alert)
    .innerJoin(schema.website, eq(schema.website.id, schema.alert.websiteId))
    .where(and(eq(schema.website.userId, user.id), eq(schema.alert.read, false)));

  const unreadAlertCount = unreadRow?.n ?? 0;

  return (
    <div className="isolate min-h-dvh bg-neutral-50/50 antialiased">
      <header className="sticky top-0 z-40 border-b border-neutral-950/5 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            aria-label="Web Watchdog home"
            className="flex shrink-0 items-center gap-2"
          >
            <LogoMark className="size-7" />
            <span className="hidden font-semibold tracking-tight text-neutral-900 sm:inline">
              Web Watchdog
            </span>
          </Link>
          <span aria-hidden className="hidden h-5 w-px bg-neutral-950/10 lg:inline-block" />
          <TopNav className="hidden lg:flex" unreadAlertCount={unreadAlertCount} />
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden lg:block">
              <HeaderUserMenu
                user={{ name: user.name, email: user.email }}
                avatarLogoUrl={profile.avatarLogoUrl ?? user.image ?? null}
              />
            </div>
            <div className="lg:hidden">
              <MobileNav
                user={{ name: user.name, email: user.email }}
                avatarLogoUrl={profile.avatarLogoUrl ?? user.image ?? null}
                unreadAlertCount={unreadAlertCount}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
