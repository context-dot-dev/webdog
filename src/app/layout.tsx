import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Web Watchdog — open-source website change monitoring",
  description:
    "Watch websites for new links, removed links, or content changes. Open-source, self-hostable, SQLite-backed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <body className="min-h-dvh bg-cream-100 font-sans text-neutral-900" suppressHydrationWarning>
        <div className="isolate">{children}</div>
      </body>
    </html>
  );
}
