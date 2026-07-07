<p align="center">
  <img src="./logo.png" width="120">
</p>

<h1 align="center">webdog.ai</h1>

<p align="center">
Watch any website. Know the moment it changes.
</p>

<p align="center">

⭐ Star us • 🏠 Self-hostable • 📜 MIT

</p>

<p align="center">
<img src="./hero.png">
</p>

---

## Built with Context.dev 🥠

webdog.ai is a fully open-source website monitoring platform built almost entirely on the **Context.dev API**.

Paste any URL and we'll:

- 📄 Scrape the page
- 🤖 Understand what changed
- 📸 Capture screenshots
- 🔍 Generate visual diffs
- 🔔 Notify you instantly

---

## Why?

Perfect for monitoring:

- 🤖 AI announcements
- 💰 Pricing pages
- 💼 Job listings
- 📰 Blogs
- 🛍️ Ecommerce
- 📚 Documentation
- 🏛️ Government websites

---

## Quick Start

```bash
git clone https://github.com/context-dot-dev/website-watchdog

npm install

cp .env.example .env

npm run db:up
npm run db:push

npm run dev
npm run worker
```

Done.

---

## Powered by

- ▲ Next.js
- ⚡ Context.dev
- 🐘 PostgreSQL
- 🔑 Better Auth
- 🐳 Docker

---

## Built using Context.dev

Want to build your own AI-powered scraper?

```ts
const html = await context.scrape("https://openai.com");
```

Everything in this repository—from screenshots to AI summaries—is powered by Context.dev.

👉 **Get your API key →**

---

## Contributing

PRs welcome ❤️

If you build something cool using Context.dev, we'd love to feature it.
