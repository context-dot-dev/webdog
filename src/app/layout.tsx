import type { Metadata } from "next";
import Script from "next/script";
import { APP_NAME } from "@/lib/product-info";
import { OpenSourceButton } from "@/components/open-source-button";
import "./globals.css";

export const metadata: Metadata = {
  title: `${APP_NAME}: open-source website change monitoring`,
  description:
    "Watch websites for new links, removed links, or content changes. Open-source, self-hostable, PostgreSQL-backed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <body className="min-h-dvh bg-cream-100 font-sans text-neutral-900" suppressHydrationWarning>
        <Script
          src="https://cdn.databuddy.cc/databuddy.js"
          data-client-id="5089fdbc-d8a2-4a4e-ac04-dbe58386227e"
          data-track-outgoing-links="true"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
        <div className="isolate">
          {children}
          <OpenSourceButton />
        </div>
      </body>
    </html>
  );
}
