import Link from "next/link";
import { redirect } from "next/navigation";
import { previewInviteFromRawToken } from "@/lib/account-invite-preview";
import { signInInviteSubtitle } from "@/lib/auth-invite-copy";
import { getCurrentSession } from "@/lib/session";
import { SignInForm } from "./form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const session = await getCurrentSession();
  if (session?.user) redirect("/dashboard");

  const { invite } = await searchParams;
  const inviteToken = invite?.trim() || null;
  const invitePreview = inviteToken ? await previewInviteFromRawToken(inviteToken) : null;

  return (
    <main className="grid min-h-dvh grid-cols-1 bg-cream-100 lg:grid-cols-[1fr_42%]">
      <div className="flex flex-col justify-between p-6 sm:p-10">
        <Link href="/" aria-label="Home" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-2xl bg-neutral-900 text-xl text-cream-100">
            🐶
          </span>
          <span className="text-lg font-semibold">Web Watchdog</span>
        </Link>
        <div className="mx-auto w-full max-w-xs">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Welcome back</h1>
          <p className="mt-2 text-sm text-neutral-600">{signInInviteSubtitle(inviteToken, invitePreview)}</p>
          <SignInForm className="mt-8" inviteToken={inviteToken} />
          <p className="mt-6 text-sm text-neutral-600">
            New here?{" "}
            <Link
              href={inviteToken ? `/sign-up?invite=${encodeURIComponent(inviteToken)}` : "/sign-up"}
              className="font-semibold text-brand-600 hover:text-brand-700"
            >
              Create an account
            </Link>
          </p>
        </div>
        <p className="text-xs text-neutral-500">
          &copy; {new Date().getFullYear()} Context.dev. Distributed under the MIT License.
        </p>
      </div>
      <AsidePanel />
    </main>
  );
}

function AsidePanel() {
  return (
    <aside className="relative hidden overflow-hidden lg:block">
      <div aria-hidden className="absolute inset-0">
        <div className="absolute -top-32 -left-20 size-[420px] rounded-full bg-peach opacity-70 blur-3xl" />
        <div className="absolute top-40 -right-32 size-[380px] rounded-full bg-mint opacity-70 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 size-[360px] rounded-full bg-lavender opacity-60 blur-3xl" />
      </div>
      <div className="relative flex h-full flex-col justify-between p-10">
        <div className="grid grid-cols-2 gap-3">
          {[
            { c: "bg-mint", icon: "🟢", t: "vercel.com/pricing", note: "Two new pricing tiers." },
            { c: "bg-peach", icon: "🔶", t: "stripe.com/legal/tos", note: "§4.2 was rewritten." },
            { c: "bg-lavender", icon: "💜", t: "acme.co/careers", note: "Listing pulled." },
            { c: "bg-white", icon: "✨", t: "yc.com/jobs", note: "47 new postings." },
          ].map((m) => (
            <div key={m.t} className={`rounded-2xl ${m.c} p-3.5 ring-1 ring-neutral-900/5`}>
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <span className="text-base">{m.icon}</span>
                <span className="truncate font-mono text-neutral-700">{m.t}</span>
              </div>
              <p className="mt-1.5 text-xs text-pretty text-neutral-700">{m.note}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="max-w-[28ch] text-balance text-3xl font-semibold tracking-tight">
            Your friendly little web watcher.
          </p>
          <p className="mt-3 max-w-[36ch] text-pretty text-sm text-neutral-700">
            Screenshots and diffs when the pages you rely on change — without
            another brittle scraper.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-700">
          <span className="size-1.5 rounded-full bg-brand-500" />
          Open source · self-hostable · MIT
        </div>
      </div>
    </aside>
  );
}
