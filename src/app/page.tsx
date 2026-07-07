import Link from "next/link";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/product-info";
import { getCurrentSession } from "@/lib/session";
import { STARTER_TEMPLATES } from "@/lib/starter-templates";
import { getStarterTemplatesWithLogos } from "@/lib/starter-template-logos.server";
import { effectiveContextDevApiKey } from "@/lib/server-managed-config";
import { WatchInput } from "@/components/watch-input";
import { AnimatedNotifList } from "@/components/animated-notif-list";
import type { NotifItem } from "@/components/animated-notif-list";
import type { StarterTemplateWithLogo } from "@/lib/starter-templates";

/** Hardcoded diff lines for the landing page Visual Diffs demo */
const DEMO_DIFF: { t: "add" | "del" | "ctx"; n: number; c: string }[] = [
  { t: "ctx", n: 1,  c: "# Stripe Pricing" },
  { t: "ctx", n: 2,  c: "" },
  { t: "ctx", n: 3,  c: "## Pro Plan" },
  { t: "del", n: 4,  c: "Monthly: $99 / month" },
  { t: "add", n: 4,  c: "Monthly: $79 / month" },
  { t: "ctx", n: 5,  c: "" },
  { t: "del", n: 6,  c: "Annual:  $79/mo · billed $948/yr" },
  { t: "add", n: 6,  c: "Annual:  $63/mo · billed $756/yr" },
  { t: "ctx", n: 7,  c: "" },
  { t: "del", n: 8,  c: "Save 20% with annual billing" },
  { t: "add", n: 8,  c: "Save 20% with annual billing 🎉" },
  { t: "ctx", n: 9,  c: "" },
  { t: "ctx", n: 10, c: "Full feature access · Priority support" },
];

const RAW_NOTIFS: Omit<NotifItem, "logoUrl">[] = [
  { id: "1", domain: "openai.com",           site: "OpenAI Blog",       message: "New post published",          time: "2m ago",  accentColor: "#111827" },
  { id: "2", domain: "stripe.com",           site: "Stripe Pricing",    message: "Pricing page updated · +25%", time: "12s ago", accentColor: "#635BFF" },
  { id: "3", domain: "anthropic.com",        site: "Anthropic Careers", message: "3 new job listings added",    time: "1m ago",  accentColor: "#CC785C" },
  { id: "4", domain: "vercel.com",           site: "Vercel Changelog",  message: "New product update shipped",  time: "5m ago",  accentColor: "#111827" },
  { id: "5", domain: "linear.app",           site: "Linear Changelog",  message: "Cycles v2 just launched",     time: "3m ago",  accentColor: "#5E6AD2" },
  { id: "6", domain: "news.ycombinator.com", site: "Hacker News",       message: "47 new job postings today",   time: "1h ago",  accentColor: "#FF6600" },
];

export default async function LandingPage() {
  const session = await getCurrentSession();
  if (session?.user) redirect("/dashboard");

  const apiKey = effectiveContextDevApiKey(null);
  let templates: StarterTemplateWithLogo[] = STARTER_TEMPLATES.map((t) => ({ ...t, logoUrl: null }));
  try {
    templates = await getStarterTemplatesWithLogos(apiKey);
  } catch {
    /* fall back to initials */
  }

  const logoMap = Object.fromEntries(templates.map((t) => [t.domain, t.logoUrl]));
  const notifItems: NotifItem[] = RAW_NOTIFS.map((n) => ({ ...n, logoUrl: logoMap[n.domain] ?? null }));

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-cream-100 font-sans text-neutral-900 antialiased">
      {/* Blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 size-[520px] rounded-full bg-peach opacity-60 blur-3xl" />
        <div className="absolute top-10 -right-40 size-[480px] rounded-full bg-mint opacity-50 blur-3xl" />
        <div className="absolute top-[820px] left-1/4 size-[420px] rounded-full bg-lavender opacity-40 blur-3xl" />
      </div>

      {/* ─── Header ─── */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-2xl bg-neutral-900 text-xl text-cream-100">🐶</span>
          <span className="font-semibold tracking-tight">{APP_NAME}</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/sign-in" className="rounded-full px-4 py-2 text-sm text-neutral-600 transition hover:text-neutral-900">
            Sign in
          </Link>
          <Link href="/sign-up" className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-cream-100 transition hover:bg-neutral-800">
            Get started free
          </Link>
        </nav>
      </header>

      {/* ─── Hero ─── */}
      <section className="mx-auto max-w-6xl px-4 pt-14 pb-10 sm:px-8 sm:pt-20">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-[1fr_400px]">

          {/* Left */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1 text-xs font-medium text-neutral-600 ring-1 ring-neutral-900/8 backdrop-blur">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Open-source · Self-hostable · MIT
            </span>

            <h1 className="mt-6 text-[2.75rem] font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl lg:text-[3.5rem]">
              The internet moves.
              <br />
              <span className="text-brand-500">We watch it for you.</span>
            </h1>

            <p className="mt-5 max-w-[44ch] text-pretty text-base text-neutral-600 sm:text-lg">
              Track any website. Get AI summaries, visual diffs, and instant alerts the moment something changes.
            </p>

            <WatchInput templates={templates} />

            <div className="mt-6 flex items-center gap-4">
              <a
                href="https://github.com/context-dot-dev/webdog"
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-800"
              >
                <GitHubIcon className="size-4" />
                Star on GitHub
              </a>
              <span className="h-4 w-px bg-neutral-900/10" />
              <span className="text-sm text-neutral-500">Free to start · no credit card</span>
            </div>
          </div>

          {/* Right: animated notification feed */}
          <div className="hidden lg:block">
            <AnimatedNotifList items={notifItems} />
          </div>
        </div>
      </section>

      {/* ─── Bento: See every change. Instantly. ─── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            See every change.{" "}
            <span className="text-brand-500">Instantly.</span>
          </h2>
          <p className="mt-3 text-sm text-neutral-500">Everything you need to stay ahead — in one place.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">

          {/* ── 1. Visual Diffs — light card ── */}
          <div className="flex flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-neutral-900/6 md:col-span-3">
            <div className="flex items-start gap-3 px-6 pt-6 pb-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-neutral-100">
                <GridIcon className="size-5 text-neutral-600" />
              </span>
              <div>
                <p className="font-semibold text-neutral-900">Visual Diffs</p>
                <p className="text-xs text-neutral-500">See exactly what changed</p>
              </div>
            </div>

            <div className="flex-1 border-t border-neutral-900/5 bg-neutral-50/70 px-5 py-4">
              {/* Diff viewer on light bg */}
              <div className="overflow-hidden rounded-xl font-mono text-xs ring-1 ring-neutral-900/8">
                {/* File header */}
                <div className="flex items-center justify-between bg-neutral-100 px-3 py-2">
                  <span className="flex items-center gap-1.5 text-neutral-500">
                    <GlobeMonoIcon className="size-3.5 shrink-0" />
                    stripe.com/pricing
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-emerald-600">+3</span>
                    <span className="font-semibold text-red-500">−3</span>
                  </span>
                </div>
                {/* Diff lines */}
                <div className="bg-white">
                  {DEMO_DIFF.map((line, i) => (
                    <div
                      key={i}
                      className={`flex ${
                        line.t === "add"
                          ? "bg-emerald-50"
                          : line.t === "del"
                            ? "bg-red-50"
                            : ""
                      }`}
                    >
                      <span className="w-9 shrink-0 select-none py-0.5 pr-2 text-right text-neutral-300">
                        {line.n}
                      </span>
                      <span
                        className={`w-5 shrink-0 select-none py-0.5 text-center font-semibold ${
                          line.t === "add"
                            ? "text-emerald-500"
                            : line.t === "del"
                              ? "text-red-400"
                              : "text-neutral-300"
                        }`}
                      >
                        {line.t === "add" ? "+" : line.t === "del" ? "−" : " "}
                      </span>
                      <span
                        className={`flex-1 whitespace-pre py-0.5 pr-3 ${
                          line.t === "add"
                            ? "text-emerald-700"
                            : line.t === "del"
                              ? "text-red-500 line-through opacity-60"
                              : "text-neutral-500"
                        }`}
                      >
                        {line.c}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button className="mt-3 flex items-center gap-1 text-xs font-semibold text-brand-600 transition hover:text-brand-500">
                View full diff <ArrowRightIcon className="size-3" />
              </button>
            </div>
          </div>

          {/* ── 2. AI Summaries — brand accent ── */}
          <div className="flex flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-neutral-900/6 md:col-span-2">
            <div className="flex items-start gap-3 px-6 pt-6 pb-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50">
                <SparkleIcon className="size-5 text-brand-500" />
              </span>
              <div>
                <p className="font-semibold text-neutral-900">AI Summaries</p>
                <p className="text-xs text-neutral-500">Understand the change</p>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-0 border-t border-neutral-900/5">
              <div className="bg-gradient-to-b from-brand-50/60 to-transparent px-5 py-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-brand-600">
                  What changed?
                </p>
                <p className="text-sm leading-relaxed text-neutral-800">
                  Stripe reduced the price of the Pro plan from{" "}
                  <strong className="text-neutral-900">$99 to $79</strong> per month
                  — a 20% decrease.
                </p>
              </div>
              <div className="flex-1 border-t border-neutral-900/5 px-5 py-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                  Why it matters
                </p>
                <p className="text-sm leading-relaxed text-neutral-600">
                  This could impact your billing strategy and competitor pricing decisions.
                </p>
              </div>
              <div className="border-t border-neutral-900/5 px-5 py-3">
                <p className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <SparkleIcon className="size-3 text-brand-400" />
                  Powered by context.dev AI
                </p>
              </div>
            </div>
          </div>

          {/* ── 3. Instant Alerts — full width, 3-panel ── */}
          <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-neutral-900/6 md:col-span-5">
            <div className="grid grid-cols-1 divide-y divide-neutral-900/5 md:grid-cols-3 md:divide-x md:divide-y-0">

              {/* Panel A: header + channels */}
              <div className="p-6">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid size-9 place-items-center rounded-xl bg-amber-50">
                    <BellIcon className="size-5 text-amber-500" />
                  </span>
                  <div>
                    <p className="font-semibold text-neutral-900">Instant Alerts</p>
                    <p className="text-xs text-neutral-500">Get notified your way</p>
                  </div>
                </div>
                <p className="mb-5 text-sm leading-relaxed text-neutral-600">
                  The second something changes, you know — through any channel you already use.
                </p>
                <div className="flex items-center gap-2">
                  {/* Slack */}
                  <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#4A154B] shadow-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/slack-logo.png" alt="Slack" className="size-5 object-contain" />
                  </span>
                  {/* Email */}
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white shadow-xs ring-1 ring-neutral-900/10">
                    <EmailIcon className="size-4 text-neutral-600" />
                  </span>
                  {/* Webhook */}
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white shadow-xs ring-1 ring-neutral-900/10">
                    <WebhookChainIcon className="size-4 text-neutral-600" />
                  </span>
                  {/* More */}
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-neutral-100">
                    <span className="text-xs font-bold text-neutral-400">···</span>
                  </span>
                </div>
              </div>

              {/* Panel B: notification mockup */}
              <div className="flex items-center justify-center bg-neutral-50/60 p-6">
                <div className="w-full max-w-[280px] rounded-2xl bg-white p-4 shadow-notif ring-1 ring-neutral-900/6">
                  <div className="mb-2.5 flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded-lg bg-neutral-900 text-sm">🐶</span>
                    <span className="text-[11px] font-semibold text-neutral-700">webdog.ai</span>
                    <span className="rounded bg-neutral-100 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-neutral-500">
                      App
                    </span>
                    <span className="ml-auto text-[10px] text-neutral-400">12:46 PM</span>
                  </div>
                  <p className="text-sm font-semibold text-neutral-900">Stripe pricing changed</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">
                    The Pro plan price was updated from $99 to $79 (+&nbsp;20%).
                  </p>
                  <div className="mt-3 inline-flex rounded-lg bg-neutral-900 px-3 py-1.5 text-[11px] font-semibold text-white">
                    View changes
                  </div>
                </div>
              </div>

              {/* Panel C: why it's different */}
              <div className="p-6">
                <p className="mb-4 text-sm font-semibold text-neutral-900">What makes it different</p>
                <ul className="space-y-3.5">
                  {[
                    { icon: "⚡", text: "Notified within seconds, not hours" },
                    { icon: "✦", text: "AI summary included in every alert" },
                    { icon: "🔒", text: "Your infra, your data — self-hostable" },
                    { icon: "📸", text: "Page screenshot attached to each check" },
                  ].map((item) => (
                    <li key={item.text} className="flex items-start gap-2.5 text-sm text-neutral-600">
                      <span className="mt-0.5 shrink-0 text-base leading-none">{item.icon}</span>
                      {item.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Dark CTA ─── */}
      <section className="mx-auto max-w-6xl px-4 pb-28 sm:px-8">
        <div className="overflow-hidden rounded-3xl bg-neutral-900 px-8 py-14 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-cream-100 sm:text-3xl">
            Start watching in 30 seconds
          </h2>
          <p className="mt-3 text-sm text-neutral-400">No credit card. No setup. Just paste a URL.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-cream-100 active:scale-[0.98]"
            >
              Start watching for free →
            </Link>
            <a
              href="https://github.com/context-dot-dev/webdog"
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm text-neutral-400 transition hover:text-white"
            >
              ★ Star on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Fortune cookie */}
      <a
        href="https://context.dev"
        target="_blank"
        rel="noreferrer noopener"
        aria-label="Built using Context.dev"
        className="fixed bottom-3 right-3 z-30 opacity-90 transition-opacity hover:opacity-100 sm:bottom-4 sm:right-4"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/fortunecookie.png" alt="Built using Context.dev" className="w-40 drop-shadow-md sm:w-52" />
      </a>
    </main>
  );
}

/* ─── Icons ─── */
function GitHubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden {...props}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function SparkleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" {...props}>
      <path d="M8 1 9.5 6.5 15 8l-5.5 1.5L8 15l-1.5-5.5L1 8l5.5-1.5z" />
    </svg>
  );
}

function BellIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

/** Email envelope — Font Awesome Free (https://fontawesome.com/license/free) */
function EmailIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 640 640" fill="currentColor" aria-hidden {...props}>
      <path d="M125.4 128C91.5 128 64 155.5 64 189.4C64 190.3 64 191.1 64.1 192L64 192L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 192L575.9 192C575.9 191.1 576 190.3 576 189.4C576 155.5 548.5 128 514.6 128L125.4 128zM528 256.3L528 448C528 456.8 520.8 464 512 464L128 464C119.2 464 112 456.8 112 448L112 256.3L266.8 373.7C298.2 397.6 341.7 397.6 373.2 373.7L528 256.3zM112 189.4C112 182 118 176 125.4 176L514.6 176C522 176 528 182 528 189.4C528 193.6 526 197.6 522.7 200.1L344.2 335.5C329.9 346.3 310.1 346.3 295.8 335.5L117.3 200.1C114 197.6 112 193.6 112 189.4z" />
    </svg>
  );
}

function WebhookChainIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  );
}

function GridIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function GlobeMonoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 2c0 0-2 2-2 6s2 6 2 6M8 2c0 0 2 2 2 6s-2 6-2 6M2 8h12" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M2 6h8M7 3l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
