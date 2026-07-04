import "server-only";
import { unstable_cache } from "next/cache";
import { pickBrandAssets, retrieveBrand } from "./context-client";
import {
  STARTER_TEMPLATES,
  type StarterTemplateWithLogo,
} from "./starter-templates";

async function resolveLogos(apiKey: string | null): Promise<StarterTemplateWithLogo[]> {
  if (!apiKey) return STARTER_TEMPLATES.map((t) => ({ ...t, logoUrl: null }));

  return Promise.all(
    STARTER_TEMPLATES.map(async (t) => {
      try {
        const brand = await retrieveBrand(t.domain, { apiKey });
        const { logoUrl } = pickBrandAssets(brand);
        return { ...t, logoUrl };
      } catch {
        return { ...t, logoUrl: null };
      }
    }),
  );
}

/**
 * Brand logos for the starter templates. Cached globally for a day — the logo
 * URLs are the same regardless of which key fetched them, so we key the cache
 * only on the template set (the API key is captured via closure, not the key).
 */
export function getStarterTemplatesWithLogos(
  apiKey: string | null,
): Promise<StarterTemplateWithLogo[]> {
  return unstable_cache(() => resolveLogos(apiKey), ["starter-template-logos-v1"], {
    revalidate: 60 * 60 * 24,
  })();
}
