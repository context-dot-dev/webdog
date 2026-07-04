/** Recognizable pages we offer as one-click starting points on an empty dashboard. */
export type StarterTemplate = {
  name: string;
  /** Full page URL to watch — a page-content monitor is created for it. */
  url: string;
  /** Normalized domain, used for brand-logo lookup and website creation. */
  domain: string;
  blurb: string;
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: "OpenAI News",
    url: "https://openai.com/news/",
    domain: "openai.com",
    blurb: "New posts on OpenAI's feed",
  },
  {
    name: "Anthropic News",
    url: "https://www.anthropic.com/news",
    domain: "anthropic.com",
    blurb: "Announcements from Anthropic",
  },
  {
    name: "Stripe Pricing",
    url: "https://stripe.com/pricing",
    domain: "stripe.com",
    blurb: "Plan & price changes",
  },
  {
    name: "Vercel Changelog",
    url: "https://vercel.com/changelog",
    domain: "vercel.com",
    blurb: "Every Vercel product update",
  },
  {
    name: "Linear Changelog",
    url: "https://linear.app/changelog",
    domain: "linear.app",
    blurb: "New Linear features",
  },
  {
    name: "Hacker News",
    url: "https://news.ycombinator.com/",
    domain: "news.ycombinator.com",
    blurb: "Changes on the HN front page",
  },
];

export type StarterTemplateWithLogo = StarterTemplate & { logoUrl: string | null };
