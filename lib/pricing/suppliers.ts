export type SupplierName = 'g2a' | 'eneba' | 'eldorado';

export type SupplierUrl = {
  supplier: SupplierName;
  url: string;
};

const SUPPLIER_HOSTS: Record<SupplierName, string[]> = {
  g2a: ['g2a.com', 'www.g2a.com'],
  eneba: ['eneba.com', 'www.eneba.com'],
  eldorado: ['eldorado.gg', 'www.eldorado.gg'],
};

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

function extractPrice(html: string) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const metadata = new Map<string, string>();

  for (const tag of metaTags) {
    const attributes = new Map<string, string>();
    const attributeMatches = Array.from(tag.matchAll(/([^\s=]+)\s*=\s*["']([^"']*)["']/g));
    for (const match of attributeMatches) {
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

export async function fetchSupplierPrice({ supplier, url }: SupplierUrl): Promise<number> {
  if (!isAllowedSupplierUrl(supplier, url)) {
    throw new Error('URL fuera del dominio HTTPS permitido para este proveedor.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'LaCasitaGamerPriceCheck/1.0 (+https://lacasitagamer.com)' },
      redirect: 'manual',
      signal: controller.signal,
      cache: 'no-store',
    });

    if (response.status >= 300 && response.status < 400) {
      throw new Error('El proveedor redirigió la solicitud; no se siguió por seguridad.');
    }
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

    const html = await readHtmlWithinLimit(response, 1_000_000);
    const price = extractPrice(html);
    if (price === null) {
      throw new Error('No se encontró un precio USD legible en la página del proveedor.');
    }
    return price;
  } finally {
    clearTimeout(timeout);
  }
}
