export type SupplierName = 'g2a' | 'eneba' | 'eldorado';

export type SupplierUrl = {
  supplier: SupplierName;
  url: string;
};

export type SupplierOffer = {
  priceUsd: number;
  sellerName: string | null;
  offerUrl: string;
};

const SUPPLIER_HOSTS: Record<SupplierName, string[]> = {
  g2a: ['g2a.com', 'www.g2a.com'],
  eneba: ['eneba.com', 'www.eneba.com'],
  eldorado: ['eldorado.gg', 'www.eldorado.gg'],
};

const OFFER_COLLECTION_KEYS = /^(offers?|otheroffers|otherlistings|listings|selleroffers|marketplaceoffers|merchantoffers|merchants|sellers)$/i;
const PRICE_KEYS = ['price', 'priceUsd', 'salePrice', 'amount', 'priceAmount', 'unitPrice'];
const CURRENCY_KEYS = ['currency', 'currencyCode', 'priceCurrency', 'currencyIsoCode'];
const SELLER_KEYS = ['sellerName', 'merchantName', 'vendorName', 'seller', 'merchant', 'vendor', 'storeName'];
const OFFER_URL_KEYS = ['offerUrl', 'listingUrl', 'productUrl', 'url', 'href'];
const PROMOTION_MARKERS = /sponsor|featured|promoted|patrocin|destacad|cashback|cash_back|advert|coupon|voucher|promo.?code|discount.?code/i;

function isAllowedSupplierUrl(supplier: SupplierName, input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return false;
  }

  return url.protocol === 'https:'
    && SUPPLIER_HOSTS[supplier].includes(url.hostname);
}

function getStringField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      for (const nestedKey of ['name', 'displayName', 'username', 'label', 'value', 'code', 'url', 'href']) {
        if (typeof nested[nestedKey] === 'string' && nested[nestedKey].trim()) {
          return nested[nestedKey].trim();
        }
      }
    }
  }
  return null;
}

function normalizePrice(value: unknown, currency: string | null): number | null {
  let price: number;
  let hasUsdMarker = false;

  if (typeof value === 'number') {
    price = value;
  } else if (typeof value === 'string') {
    const cleaned = value.trim();
    hasUsdMarker = /\bUSD\b|\$/i.test(cleaned);
    const numeric = cleaned.replace(/[^0-9.,-]/g, '');
    if (!numeric || (numeric.includes(',') && numeric.includes('.'))) {
      const normalized = numeric.replace(/,/g, '');
      price = Number(normalized);
    } else {
      price = Number(numeric.replace(',', '.'));
    }
  } else {
    return null;
  }

  if ((!hasUsdMarker && currency?.toUpperCase() !== 'USD') || !Number.isFinite(price) || price <= 0) {
    return null;
  }
  return Number(price.toFixed(2));
}

function offerIsPromoted(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(offerIsPromoted);
  if (!value || typeof value !== 'object') return false;

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase();
    if (PROMOTION_MARKERS.test(normalizedKey)) {
      if (
        /coupon|voucher|promo.?code|discount.?code/i.test(normalizedKey)
        && nested !== null
        && nested !== false
        && nested !== 0
        && nested !== ''
      ) return true;
      if (nested === true || (typeof nested === 'number' && nested > 0)) return true;
      if (typeof nested === 'string' && (PROMOTION_MARKERS.test(nested)
        || /^(true|1|yes)$/i.test(nested.trim()))) {
        return true;
      }
      if (normalizedKey.includes('cashback') || normalizedKey.includes('cash_back')) {
        const cashbackAmount = typeof nested === 'string'
          ? Number(nested.replace(/[^0-9.,-]/g, '').replace(',', '.'))
          : Number(nested);
        if (Number.isFinite(cashbackAmount) && cashbackAmount > 0) return true;
        if (
          nested
          && typeof nested === 'object'
          && Object.values(nested as Record<string, unknown>).some((entry) => {
            const amount = typeof entry === 'string' ? Number(entry.replace(/[$,\s]/g, '')) : Number(entry);
            return Number.isFinite(amount) && amount > 0;
          })
        ) return true;
      }
    }
    if (
      typeof nested === 'string'
      && PROMOTION_MARKERS.test(nested)
    ) return true;
    if (offerIsPromoted(nested)) return true;
  }
  return false;
}

function readOffer(value: unknown, supplier: SupplierName): SupplierOffer | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) || offerIsPromoted(value)) return null;

  const record = value as Record<string, unknown>;
  const currency = getStringField(record, CURRENCY_KEYS);
  let priceUsd: number | null = null;
  for (const key of PRICE_KEYS) {
    if (!(key in record)) continue;
    const rawPrice = record[key];
    if (rawPrice && typeof rawPrice === 'object' && !Array.isArray(rawPrice)) {
      const priceRecord = rawPrice as Record<string, unknown>;
      const nestedCurrency = getStringField(priceRecord, CURRENCY_KEYS) ?? currency;
      for (const nestedKey of ['amount', 'value', 'price']) {
        if (nestedKey in priceRecord) {
          priceUsd = normalizePrice(priceRecord[nestedKey], nestedCurrency);
          if (priceUsd !== null) break;
        }
      }
    } else {
      priceUsd = normalizePrice(rawPrice, currency);
    }
    if (priceUsd !== null) break;
  }

  if (priceUsd === null) return null;
  const offerUrl = getStringField(record, OFFER_URL_KEYS);
  let normalizedOfferUrl = supplierListingUrl(supplier);
  if (offerUrl) {
    try {
      const candidateUrl = new URL(offerUrl, normalizedOfferUrl);
      if (candidateUrl.protocol === 'https:' && SUPPLIER_HOSTS[supplier].includes(candidateUrl.hostname)) {
        normalizedOfferUrl = candidateUrl.toString();
      }
    } catch {
      // Ignore malformed offer URLs and link to the configured product listing.
    }
  }

  return {
    priceUsd,
    sellerName: getStringField(record, SELLER_KEYS),
    offerUrl: normalizedOfferUrl,
  };
}

function supplierListingUrl(supplier: SupplierName) {
  switch (supplier) {
    case 'eneba':
      return 'https://www.eneba.com/latam/steam-gift-card-steam-wallet-gift-card-10-usd-steam-key-united-states';
    case 'g2a':
      return 'https://www.g2a.com/es/steam-gift-card-10-usd-steam-key-global-i10000000258127';
    case 'eldorado':
      return 'https://www.eldorado.gg/es/steam-gift-card/v/42?te_v1=3-0';
  }
}

function collectOffers(value: unknown, supplier: SupplierName, parentIsOfferList = false): SupplierOffer[] {
  if (Array.isArray(value)) {
    if (!parentIsOfferList) return value.flatMap((item) => collectOffers(item, supplier));
    return value.flatMap((item) => {
      const offer = readOffer(item, supplier);
      return offer ? [offer] : collectOffers(item, supplier);
    });
  }
  if (!value || typeof value !== 'object') return [];

  const offers: SupplierOffer[] = [];
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (OFFER_COLLECTION_KEYS.test(key)) {
      offers.push(...collectOffers(nested, supplier, true));
    } else {
      offers.push(...collectOffers(nested, supplier));
    }
  }
  return offers;
}

function parseEmbeddedJson(html: string) {
  const payloads: unknown[] = [];
  const scripts = Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi));

  for (const script of scripts) {
    const attributes = script[1];
    const contents = script[2].trim();
    const isJson = /type=["']application\/(?:ld\+)?json["']/i.test(attributes)
      || /id=["']__NEXT_DATA__["']/i.test(attributes);
    if (!contents) continue;

    if (isJson) {
      try {
        payloads.push(JSON.parse(contents));
      } catch {
        payloads.push(...parseJsonObjectFragments(contents));
      }
    }

    const flightPayloads = Array.from(contents.matchAll(/__next_f\.push\(\s*\[\s*\d+\s*,\s*("(?:\\.|[^"\\])*")\s*\]\s*\)/g));
    for (const flightPayload of flightPayloads) {
      try {
        const decoded = JSON.parse(flightPayload[1]);
        if (typeof decoded === 'string') payloads.push(...parseJsonObjectFragments(decoded));
      } catch {
        continue;
      }
    }
  }
  return payloads;
}

function parseJsonObjectFragments(text: string): unknown[] {
  const payloads: unknown[] = [];
  const starts: number[] = [];
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length && payloads.length < 1000; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
    } else if (character === '{') {
      starts.push(index);
    } else if (character === '}' && starts.length > 0) {
      const start = starts.pop()!;
      if (index - start > 200_000) continue;
      try {
        payloads.push(JSON.parse(text.slice(start, index + 1)));
      } catch {
        continue;
      }
    }
  }
  return payloads;
}

function readPriceFromJsonLd(value: unknown): number | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const price = readPriceFromJsonLd(item);
      if (price !== null) return price;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  if (record.offers) {
    const offers = Array.isArray(record.offers) ? record.offers : [record.offers];
    for (const offer of offers) {
      if (!offer || typeof offer !== 'object') continue;
      const offerRecord = offer as Record<string, unknown>;
      const currency = offerRecord.priceCurrency ?? offerRecord.priceCurrencyCode;
      const price = Number(offerRecord.price ?? offerRecord.lowPrice);
      if (currency === 'USD' && Number.isFinite(price) && price > 0) return price;
    }
  }
  for (const nested of Object.values(record)) {
    const price = readPriceFromJsonLd(nested);
    if (price !== null) return price;
  }
  return null;
}

function extractGenericPrice(html: string): number | null {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const metadata = new Map<string, string>();
  for (const tag of metaTags) {
    const attributes = new Map<string, string>();
    for (const match of Array.from(tag.matchAll(/([^\s=]+)\s*=\s*["']([^"']*)["']/g))) {
      attributes.set(match[1].toLowerCase(), match[2]);
    }
    const key = attributes.get('property') ?? attributes.get('name') ?? attributes.get('itemprop');
    const content = attributes.get('content');
    if (key && content) metadata.set(key.toLowerCase(), content);
  }

  const currency = metadata.get('og:price:currency')
    ?? metadata.get('product:price:currency')
    ?? metadata.get('pricecurrency');
  const metaPrice = metadata.get('og:price:amount')
    ?? metadata.get('product:price:amount')
    ?? metadata.get('product:price')
    ?? metadata.get('price');
  if ((!currency || currency.toUpperCase() === 'USD') && metaPrice) {
    const price = Number(metaPrice.replace(/[$,\s]/g, ''));
    if (Number.isFinite(price) && price > 0) return price;
  }

  const scripts = Array.from(html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
  for (const script of scripts) {
    try {
      const price = readPriceFromJsonLd(JSON.parse(script[1]));
      if (price !== null) return price;
    } catch {
      continue;
    }
  }
  return null;
}

async function readHtmlWithinLimit(response: Response, maxBytes: number) {
  if (!response.body) {
    throw new Error('El proveedor devolvió una respuesta vacía.');
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error('La página del proveedor excede el tamaño permitido.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function fetchSupplierHtml({ supplier, url }: SupplierUrl): Promise<string> {
  if (!isAllowedSupplierUrl(supplier, url)) {
    throw new Error('URL fuera del dominio HTTPS permitido para este proveedor.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    let targetUrl = url;
    let response: Response | null = null;
    for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
      response = await fetch(targetUrl, {
        headers: { 'user-agent': 'LaCasitaGamerPriceCheck/1.0 (+https://lacasitagamer.com)' },
        redirect: 'manual',
        signal: controller.signal,
        cache: 'no-store',
      });

      if (response.status < 300 || response.status >= 400) break;
      const location = response.headers.get('location');
      if (!location || redirectCount === 3) {
        throw new Error('El proveedor devolvió una redirección no válida o excedió el límite permitido.');
      }
      const redirectedUrl = new URL(location, targetUrl).toString();
      if (!isAllowedSupplierUrl(supplier, redirectedUrl)) {
        throw new Error('La redirección del proveedor sale del dominio HTTPS permitido.');
      }
      targetUrl = redirectedUrl;
    }
    if (!response) throw new Error('El proveedor no devolvió una respuesta.');
    if (!response.ok) {
      throw new Error(`El proveedor respondió con el estado ${response.status}.`);
    }
    if (!response.headers.get('content-type')?.includes('text/html')) {
      throw new Error('El proveedor no devolvió una página HTML.');
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > 1_000_000) {
      throw new Error('La página del proveedor excede el tamaño permitido.');
    }

    return await readHtmlWithinLimit(response, 1_000_000);
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSupplierOffer({ supplier, url }: SupplierUrl): Promise<SupplierOffer> {
  const html = await fetchSupplierHtml({ supplier, url });
  const offers = parseEmbeddedJson(html)
    .flatMap((payload) => collectOffers(payload, supplier))
    .sort((left, right) => left.priceUsd - right.priceUsd);
  if (offers.length === 0) {
    throw new Error('No se encontraron ofertas públicas no patrocinadas con precio USD verificable.');
  }
  return offers[0];
}

export async function fetchSupplierPrice(input: SupplierUrl): Promise<number> {
  const html = await fetchSupplierHtml(input);
  const price = extractGenericPrice(html);
  if (price === null) {
    throw new Error('No se encontró un precio USD legible en la página del proveedor.');
  }
  return price;
}
