import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";

export default async function LandingPage() {
  const session = await getCurrentSession();
  if (session?.user) redirect("/dashboard");

  return (
    <main
      className="relative min-h-dvh overflow-hidden bg-[#fdf6ec] text-neutral-900"
      style={{ fontFamily: '"Figtree", ui-sans-serif, system-ui' }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 size-[500px] rounded-full bg-[#ffd5b5] opacity-70 blur-3xl" />
        <div className="absolute top-40 -right-40 size-[480px] rounded-full bg-[#cdebd6] opacity-80 blur-3xl" />
        <div className="absolute top-[700px] left-1/3 size-[420px] rounded-full bg-[#e7d6ff] opacity-60 blur-3xl" />
      </div>

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-2xl bg-neutral-900 text-2xl text-[#fdf6ec]">🐶</span>
          <span className="text-lg font-semibold">Web Watchdog</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link href="#features" className="rounded-full px-4 py-2 text-sm text-neutral-700 hover:bg-white/60">Features</Link>
          <Link href="#pricing" className="rounded-full px-4 py-2 text-sm text-neutral-700 hover:bg-white/60">Pricing</Link>
          <Link href="/sign-in" className="rounded-full px-4 py-2 text-sm text-neutral-700 hover:bg-white/60">Sign in</Link>
          <Link
            href="/sign-up"
            className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-[#fdf6ec] transition hover:bg-neutral-800"
          >
            Try free
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 pt-16 pb-20 text-center">
        <p className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-sm text-neutral-700 ring-1 ring-neutral-900/5 backdrop-blur">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Open-source · self-hostable · MIT
        </p>
        <h1 className="mx-auto mt-8 max-w-[18ch] text-5xl font-semibold tracking-tight text-balance sm:text-7xl">
          Your friendly little{" "}
          <span className="relative inline-block">
            web watcher
            <svg
              aria-hidden
              viewBox="0 0 220 14"
              className="absolute -bottom-2 left-0 w-full"
              fill="none"
            >
              <path
                d="M2 9 C 40 1, 80 13, 120 6 S 200 11, 218 4"
                stroke="#ff7a3b"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </span>
          .
        </h1>
        <p className="mx-auto mt-8 max-w-[52ch] text-pretty text-lg text-neutral-700">
          Web Watchdog keeps an eye on the pages you care about — a new blog
          post, a removed job listing, a quietly tweaked pricing page — and
          gives you a friendly nudge the moment something changes.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sign-up"
            className="rounded-2xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-[#fdf6ec] transition hover:translate-y-[-1px] hover:bg-neutral-800"
          >
            Get started — it&apos;s free 🍊
          </Link>
          <a
            href="https://github.com"
            className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-neutral-900 ring-1 ring-neutral-900/10 transition hover:bg-neutral-50"
            target="_blank"
            rel="noreferrer noopener"
          >
            ★ Star on GitHub
          </a>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            {
              c: "bg-[#cdebd6]",
              icon: "🟢",
              t: "vercel.com/pricing",
              note: "Hey! Two new pricing tiers just appeared.",
              time: "2 min ago",
            },
            {
              c: "bg-[#ffd5b5]",
              icon: "🔶",
              t: "stripe.com/legal/tos",
              note: "Section 4.2 was rewritten — want a diff?",
              time: "11 min ago",
            },
            {
              c: "bg-[#e7d6ff]",
              icon: "💜",
              t: "acme.co/careers",
              note: "The senior eng listing was pulled.",
              time: "34 min ago",
            },
            {
              c: "bg-white",
              icon: "✨",
              t: "ycombinator.com/jobs",
              note: "47 new postings since this morning.",
              time: "1 hr ago",
            },
          ].map((m) => (
            <div
              key={m.t}
              className={`rounded-3xl ${m.c} p-5 text-left ring-1 ring-neutral-900/5`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="text-lg">{m.icon}</span>
                  <span className="font-mono">{m.t}</span>
                </span>
                <span className="text-xs text-neutral-600">{m.time}</span>
              </div>
              <p className="mt-3 text-pretty text-neutral-800">{m.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="relative mx-auto max-w-6xl px-6 pb-24">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              c: "bg-[#cdebd6]",
              icon: "🌱",
              title: "New links",
              desc: "Catch articles, jobs, or products the moment they're published.",
            },
            {
              c: "bg-[#ffd5b5]",
              icon: "🍂",
              title: "Removed links",
              desc: "Notice when a competitor quietly pulls a page or shifts inventory.",
            },
            {
              c: "bg-[#e7d6ff]",
              icon: "🔍",
              title: "Content changes",
              desc: "Diff entire sites or single pages, down to the paragraph.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className={`rounded-3xl ${f.c} p-7 ring-1 ring-neutral-900/5 transition hover:translate-y-[-2px]`}
            >
              <div className="grid size-12 place-items-center rounded-2xl bg-white/70 text-3xl ring-1 ring-neutral-900/5">
                {f.icon}
              </div>
              <p className="mt-5 text-lg font-semibold">{f.title}</p>
              <p className="mt-2 text-pretty text-neutral-700">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
