"use client";

import { useState } from "react";
import type { TargetCurrentContent } from "@/lib/target-fetch-history";
import { formatProductPrice } from "@/lib/product-price-history";
import { RelativeTime } from "./relative-time";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost px-2 py-1 text-xs"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/**
 * Shows the most recent content Context.dev captured for a target — the "current
 * version" — so users can see what's being watched without waiting for a change.
 * Page content is shown as the raw markdown Context.dev returned.
 */
export function TargetCurrentContent({ content }: { content: TargetCurrentContent | null }) {
  if (!content) {
    return (
      <div className="rounded-xl bg-white p-4 text-xs text-neutral-600 ring-1 ring-neutral-950/10">
        No content captured yet. Run a check to capture the current version.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white ring-1 ring-neutral-950/10">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-950/5 px-3 py-2">
        <div className="text-xs font-medium text-neutral-800">
          Current version
          <span className="ml-2 font-normal text-neutral-500">
            captured <RelativeTime date={content.capturedAt} />
          </span>
        </div>
        {content.kind === "markdown" && content.markdown.trim().length > 0 ? (
          <CopyButton text={content.markdown} />
        ) : null}
      </div>

      <div className="p-3">
        {content.kind === "markdown" ? (
          content.markdown.trim().length > 0 ? (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-neutral-50 p-3 font-mono text-[0.72rem] leading-relaxed text-neutral-800">
              {content.markdown}
            </pre>
          ) : (
            <p className="text-xs text-neutral-500">
              Context.dev returned an empty page. The page may block scraping or have no main content.
            </p>
          )
        ) : null}

        {content.kind === "sitemap" ? (
          <div>
            <p className="mb-2 text-xs text-neutral-600">
              {content.urls.length} URL{content.urls.length === 1 ? "" : "s"} in the current sitemap.
            </p>
            {content.urls.length > 0 ? (
              <ul className="max-h-96 space-y-1 overflow-auto rounded-lg bg-neutral-50 p-3">
                {content.urls.map((u) => (
                  <li key={u}>
                    <a
                      href={u}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="block truncate font-mono text-[0.72rem] text-brand-800 hover:underline"
                      title={u}
                    >
                      {u}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-neutral-500">No URLs captured.</p>
            )}
          </div>
        ) : null}

        {content.kind === "product" ? (
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div>
              <div className="text-xs text-neutral-500">Product</div>
              <div className="text-sm font-medium text-neutral-900">
                {content.product.productName ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-xs text-neutral-500">Current price</div>
              <div className="text-sm font-semibold tabular-nums text-neutral-900">
                {content.product.is_product_page
                  ? formatProductPrice(content.product.price, content.product.currency)
                  : "Not detected as a product page"}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
