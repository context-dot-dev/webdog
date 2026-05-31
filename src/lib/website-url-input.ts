/** Parsed domain field + optional path from a pasted or typed website URL. */
export type ParsedWebsiteUrlInput = {
  /** Host for the domain input (may include port; not www-stripped). */
  domainHost: string;
  /** Path + query on the same host, e.g. `/pricing` or `/blog/post?q=1`. */
  pagePath: string | null;
};

/**
 * Splits user input into hostname (for the website) and an optional path (for a page content target).
 */
export function parseWebsiteUrlInput(raw: string): ParsedWebsiteUrlInput {
  const t = raw.trim();
  if (!t) return { domainHost: "", pagePath: null };

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      const combined = u.pathname + u.search;
      const pagePath = combined === "/" || combined === "" ? null : combined;
      return { domainHost: u.host, pagePath };
    } catch {
      /* fall through */
    }
  }

  const noProto = t.replace(/^\/\//, "").replace(/^https?:\/\//i, "");
  const slashIdx = noProto.indexOf("/");
  const questionIdx = noProto.indexOf("?");

  if (slashIdx >= 0) {
    const domainHost = noProto.slice(0, slashIdx).split("#")[0].trim();
    const tail = noProto.slice(slashIdx).split("#")[0];
    const pagePath = tail === "/" ? null : tail;
    return { domainHost, pagePath };
  }

  if (questionIdx >= 0) {
    const domainHost = noProto.slice(0, questionIdx).split("#")[0].trim();
    const pagePath = `/${noProto.slice(questionIdx).split("#")[0]}`;
    return { domainHost, pagePath };
  }

  const domainHost = noProto.split("#")[0].trim();
  return { domainHost, pagePath: null };
}

/** Builds an absolute https URL for a normalized domain and relative path. */
export function buildInitialPageUrl(domain: string, pagePath: string): string {
  const path = pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
  return `https://${domain}${path}`;
}
