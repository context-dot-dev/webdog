import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
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
    <main className="grid min-h-dvh grid-cols-1 bg-white lg:grid-cols-[1fr_42%]">
      <div className="flex flex-col justify-between p-6 sm:p-10">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <div className="mx-auto w-full max-w-xs">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Welcome back</h1>
          <p className="mt-1 text-sm text-neutral-600">{signInInviteSubtitle(inviteToken, invitePreview)}</p>
          <SignInForm className="mt-8" inviteToken={inviteToken} />
          <p className="mt-6 text-sm text-neutral-600">
            New here?{" "}
            <Link
              href={inviteToken ? `/sign-up?invite=${encodeURIComponent(inviteToken)}` : "/sign-up"}
              className="font-medium text-brand-600 hover:text-brand-700"
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
    <aside className="relative hidden overflow-hidden bg-neutral-950 text-white lg:block">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,90,31,0.25),transparent_60%)]" />
      <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:40px_40px]" />
      <div className="relative flex h-full flex-col justify-between p-12">
        <div />
        <div>
          <p className="max-w-[34ch] text-balance text-2xl font-medium tracking-tight">
            Screenshots and diffs when the pages you rely on change, without another brittle scraper.
          </p>
          <div className="mt-6 text-sm text-neutral-400">Proudly open source.</div>
        </div>
        <div className="flex items-center gap-3 text-xs text-neutral-400">
          <span className="inline-flex size-2 rounded-full bg-brand-500 shadow-[0_0_0_4px_rgba(255,90,31,0.2)]" />
          Get notified on every change
        </div>
      </div>
    </aside>
  );
}
