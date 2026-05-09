import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Logo } from "@/components/logo";
import { ContextDevOnboardingForm } from "@/components/context-dev-onboarding-form";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { requireUser } from "@/lib/session";
import { isContextDevApiKeyManagedByEnv } from "@/lib/server-managed-config";

export default async function ContextDevOnboardingPage() {
  const sessionUser = await requireUser();

  if (isContextDevApiKeyManagedByEnv()) {
    redirect("/dashboard");
  }

  const [introRow] = await db
    .select({
      dismissed: schema.user.contextIntroDismissedAt,
    })
    .from(schema.user)
    .where(eq(schema.user.id, sessionUser.id))
    .limit(1);

  if (introRow?.dismissed != null) {
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1fr_42%]">
      <div className="flex flex-col justify-between p-6 sm:p-10">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Connect Context.dev</h1>
          <ContextDevOnboardingForm className="mt-6" userName={sessionUser.name ?? "there"} />
        </div>
        <p className="text-xs text-neutral-500">
          &copy; {new Date().getFullYear()} Context.dev. Distributed under the MIT License.
        </p>
      </div>
      <aside className="relative hidden overflow-hidden bg-neutral-950 text-white lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,90,31,0.25),transparent_60%)]" />
        <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:40px_40px]" />
        <div className="relative flex h-full flex-col justify-center p-12">
          <p className="text-sm font-medium text-brand-400">Powered by APIs</p>
          <h2 className="mt-2 max-w-[28ch] text-balance text-2xl font-semibold tracking-tight">
            Scrape smarter with structured web data built for builders.
          </h2>
        </div>
      </aside>
    </main>
  );
}
