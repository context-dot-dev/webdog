import type { Metadata } from "next";
import Script from "next/script";
import { APP_NAME } from "@/lib/product-info";
import "./globals.css";

export const metadata: Metadata = {
  title: `${APP_NAME} — open-source website change monitoring`,
  description:
    "Watch websites for new links, removed links, or content changes. Open-source, self-hostable, PostgreSQL-backed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <body className="min-h-dvh bg-cream-100 font-sans text-neutral-900" suppressHydrationWarning>
        <Script
          src="https://plausible.io/js/pa-Ou4G9tTYPGSI77dWeauzs.js"
          strategy="afterInteractive"
        />
        <Script id="plausible-init" strategy="afterInteractive">
          {`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
plausible.init()`}
        </Script>
        <div className="isolate">{children}</div>
      </body>
    </html>
  );
}
