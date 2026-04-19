import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { Logo } from "@/components/logo";

export default async function LandingPage() {
  const session = await getCurrentSession();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="relative min-h-dvh bg-white">
      <HeroGrid />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/sign-in" className="btn-ghost">
            Sign in
          </Link>
          <Link href="/sign-up" className="btn-primary">
            Get started
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 pt-16 pb-24 sm:pt-24 sm:pb-32">
        <div className="mx-auto max-w-[60ch] text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-500/20">
            <span className="size-1.5 rounded-full bg-brand-500" />
            Open source &middot; SQLite &middot; self-hostable
          </p>
          <h1 className="mx-auto mt-6 max-w-[20ch] text-balance text-5xl font-semibold tracking-tight text-neutral-900 sm:text-7xl">
            Watch the web. <span className="text-brand-500">Not manually.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[54ch] text-pretty text-lg text-neutral-600">
            Web Watchdog tracks the pages you care about — a new post on a blog, a removed job listing,
            a quietly edited pricing page — and tells you the moment something changes.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/sign-up" className="btn-accent px-4 py-2.5">
              Start watching — free
            </Link>
            <a
              href="https://github.com"
              className="btn-secondary px-4 py-2.5"
              target="_blank"
              rel="noreferrer noopener"
            >
              View source
            </a>
          </div>
        </div>

        <dl className="mx-auto mt-20 grid max-w-4xl grid-cols-1 gap-px overflow-hidden rounded-2xl bg-neutral-200/60 ring-1 ring-neutral-950/5 sm:grid-cols-3">
          {[
            { label: "New links", desc: "Catch articles, jobs, or products the moment they're published." },
            { label: "Removed links", desc: "Know when a competitor quietly pulls a page or changes inventory." },
            { label: "Content changes", desc: "Diff entire sites or single pages, down to the paragraph." },
          ].map((f) => (
            <div key={f.label} className="bg-white p-6">
              <dt className="text-sm font-medium text-neutral-900">{f.label}</dt>
              <dd className="mt-2 text-sm text-neutral-600 text-pretty">{f.desc}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}

function HeroGrid() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,theme(colors.brand.50),transparent_60%)]" />
      <svg
        className="absolute inset-x-0 top-0 h-[520px] w-full stroke-neutral-950/5"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="ww-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M.5 40V.5H40" fill="none" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ww-grid)" />
      </svg>
    </div>
  );
}
