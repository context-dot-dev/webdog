import Link from "next/link";
import { redirect } from "next/navigation";
import { previewInviteFromRawToken } from "@/lib/account-invite-preview";
import { signUpInviteSubtitle } from "@/lib/auth-invite-copy";
import { APP_NAME } from "@/lib/product-info";
import { getCurrentSession } from "@/lib/session";
import { SignUpForm } from "./form";

export default async function SignUpPage({
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
          <span className="text-lg font-semibold">{APP_NAME}</span>
        </Link>
        <div className="mx-auto w-full max-w-xs">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Create your account</h1>
          <p className="mt-2 text-sm text-neutral-600">{signUpInviteSubtitle(inviteToken, invitePreview)}</p>
          <SignUpForm className="mt-8" inviteToken={inviteToken} />
          <p className="mt-6 text-sm text-neutral-600">
            Already have an account?{" "}
            <Link
              href={inviteToken ? `/sign-in?invite=${encodeURIComponent(inviteToken)}` : "/sign-in"}
              className="font-semibold text-brand-600 hover:text-brand-700"
            >
              Sign in
            </Link>
          </p>
        </div>
        <p className="text-xs text-neutral-500">
          &copy; {new Date().getFullYear()} Context.dev. Distributed under the MIT License.
        </p>
      </div>
      <aside className="relative hidden overflow-hidden lg:block">
        <div aria-hidden className="absolute inset-0">
          <div className="absolute -top-32 -left-20 size-[420px] rounded-full bg-mint opacity-70 blur-3xl" />
          <div className="absolute top-40 -right-32 size-[380px] rounded-full bg-peach opacity-70 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 size-[360px] rounded-full bg-lavender opacity-60 blur-3xl" />
        </div>
        <div className="relative flex h-full flex-col justify-center p-12">
          <h2 className="max-w-[20ch] text-balance text-4xl font-semibold tracking-tight">
            Three ways to watch any website.
          </h2>
          <ul role="list" className="mt-10 space-y-3">
            {[
              { c: "bg-mint", icon: "🌱", t: "New links", d: "Alert me when a sitemap grows." },
              { c: "bg-peach", icon: "🍂", t: "Removed links", d: "Alert me when something disappears." },
              { c: "bg-lavender", icon: "🔍", t: "Page content", d: "Watch a single page, paragraph-level." },
            ].map((row) => (
              <li
                key={row.t}
                className={`flex items-start gap-4 rounded-2xl ${row.c} p-4 ring-1 ring-neutral-900/5`}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/70 text-xl ring-1 ring-neutral-900/5">
                  {row.icon}
                </span>
                <div>
                  <div className="font-semibold text-neutral-900">{row.t}</div>
                  <div className="mt-0.5 text-sm text-neutral-700">{row.d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  );
}
