import { parse } from 'node-html-parser';
import { v } from 'convex/values';
import { action, env } from './_generated/server';

type CanopyProduct = {
  data?: {
    amazonProduct?: {
      title?: string;
      featureBullets?: string[];
      price?: { value?: number; display?: string };
      mainImageUrl?: string;
      images?: Array<{ url?: string; hiRes?: string }>;
    };
  };
};

type ParseResult = {
  name: string | null;
  notes: string | null;
  price: number | null;
  imageUrl: string | null;
};

function extractAsin(url: string): string | null {
  const match = url.match(/\/dp\/([A-Z0-9]{10})/i);
  return match ? match[1] : null;
}

function isAmazonUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'amazon.com' || hostname.endsWith('.amazon.com');
  } catch {
    return false;
  }
}

async function parseAmazon(url: string, apiKey: string): Promise<ParseResult | null> {
  const asin = extractAsin(url);
  if (!asin) return null;

  const apiUrl = `https://rest.canopyapi.co/api/amazon/product?asin=${asin}`;
  const response = await fetch(apiUrl, { headers: { 'API-KEY': apiKey } });
  if (!response.ok) return null;

  const product = (await response.json()) as CanopyProduct;
  const ap = product?.data?.amazonProduct;
  const price = ap?.price?.value ?? null;
  const notes = ap?.featureBullets?.slice(0, 2).join(' ') ?? null;
  const imageUrl =
    ap?.mainImageUrl ??
    ap?.images?.[0]?.hiRes ??
    ap?.images?.[0]?.url ??
    null;

  return {
    name: ap?.title?.trim() ?? null,
    notes: notes?.trim() ?? null,
    price: price && price > 0 ? price : null,
    imageUrl: imageUrl ?? null,
  };
}

function extractPrice(root: ReturnType<typeof parse>): number | null {
  for (const attr of ['product:price:amount', 'og:price:amount']) {
    const content =
      root.querySelector(`meta[property="${attr}"]`)?.getAttribute('content') ??
      root.querySelector(`meta[name="${attr}"]`)?.getAttribute('content');
    if (content) {
      const n = parseFloat(content.replace(/[^0-9.]/g, ''));
      if (!isNaN(n) && n > 0) return n;
    }
  }

  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.text) as Record<string, unknown>;
      const offers = data?.offers as Record<string, unknown> | undefined;
      const raw = offers?.price ?? data?.price;
      if (raw != null) {
        const n = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
        if (!isNaN(n) && n > 0) return n;
      }
    } catch {
      // malformed JSON-LD — skip
    }
  }

  return null;
}

async function parseGeneric(url: string): Promise<ParseResult | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  const response = await fetch(url, {
    signal: controller.signal,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      Accept: 'text/html',
    },
  });
  clearTimeout(timeoutId);

  if (!response.ok) return null;
  if (!response.headers.get('content-type')?.includes('text/html')) return null;

  const html = await response.text();
  const root = parse(html);

  const name =
    root.querySelector('meta[property="og:title"]')?.getAttribute('content') ??
    root.querySelector('title')?.text ??
    null;

  const notes =
    root.querySelector('meta[property="og:description"]')?.getAttribute('content') ??
    root.querySelector('meta[name="description"]')?.getAttribute('content') ??
    null;

  const imageUrl =
    root.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? null;

  return {
    name: name?.trim() ?? null,
    notes: notes?.trim() ?? null,
    price: extractPrice(root),
    imageUrl: imageUrl?.trim() ?? null,
  };
}

export const parseLink = action({
  args: { url: v.string() },
  handler: async (_ctx, args): Promise<ParseResult | null> => {
    try {
      if (isAmazonUrl(args.url) && env.CANOPY_API_KEY) {
        return await parseAmazon(args.url, env.CANOPY_API_KEY);
      }
      return await parseGeneric(args.url);
    } catch {
      return null;
    }
  },
});
