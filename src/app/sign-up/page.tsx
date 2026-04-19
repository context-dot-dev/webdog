import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { Logo } from "@/components/logo";
import { SignUpForm } from "./form";

export default async function SignUpPage() {
  const session = await getCurrentSession();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="grid min-h-dvh grid-cols-1 bg-white lg:grid-cols-[1fr_42%]">
      <div className="flex flex-col justify-between p-6 sm:p-10">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <div className="mx-auto w-full max-w-xs">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Create your account</h1>
          <p className="mt-1 text-sm text-neutral-600">Start watching the web in under a minute.</p>
          <SignUpForm className="mt-8" />
          <p className="mt-6 text-sm text-neutral-600">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-brand-600 hover:text-brand-700">
              Sign in
            </Link>
          </p>
        </div>
        <p className="text-xs text-neutral-500">&copy; {new Date().getFullYear()} Web Watchdog</p>
      </div>
      <aside className="relative hidden overflow-hidden bg-neutral-950 text-white lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,90,31,0.25),transparent_60%)]" />
        <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:40px_40px]" />
        <div className="relative flex h-full flex-col justify-center p-12">
          <h2 className="max-w-[24ch] text-balance text-3xl font-semibold tracking-tight">
            Three ways to watch any website.
          </h2>
          <ul role="list" className="mt-8 space-y-4 text-sm text-neutral-300">
            {[
              ["New links", "Alert me when a sitemap grows."],
              ["Removed links", "Alert me when something disappears."],
              ["Page content", "Watch a single page, paragraph-level."],
            ].map(([t, d]) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
                <div>
                  <div className="font-medium text-white">{t}</div>
                  <div className="text-neutral-400">{d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  );
}
