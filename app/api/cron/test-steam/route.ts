import { NextResponse } from 'next/server';
import { fetchMontosveRate } from '../../../../lib/pricing/bcv';
import { fetchSupplierOffer, type SupplierName } from '../../../../lib/pricing/suppliers';
import { getSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const VARIANT_ID = 'v-s10-glo';
const PRODUCT_NAME = 'Steam Gift Card $10';
const FALLBACK_SUPPLIERS: SupplierRow[] = [
  {
    supplier: 'eneba',
    url: 'https://www.eneba.com/latam/steam-gift-card-steam-wallet-gift-card-10-usd-steam-key-united-states',
  },
  {
    supplier: 'g2a',
    url: 'https://www.g2a.com/es/steam-gift-card-10-usd-steam-key-global-i10000000258127',
  },
];

type SupplierRow = {
  supplier: SupplierName;
  url: string;
};

const PROVIDER_NAMES: Record<SupplierName, string> = {
  eneba: 'Eneba',
  g2a: 'G2A',
  eldorado: 'Eldorado',
};

type SupplierCheck = {
  variant_id: string;
  supplier: SupplierName;
  source_url: string;
  price_usd: number | null;
  final_price_usd: number | null;
  seller_name: string | null;
  offer_url: string | null;
  error: string | null;
  checked_at: string;
};

type ProductSyncResult = {
  success: boolean;
  variant_id: string;
  product_id: string;
  provider: 'Eneba';
  best_price_usd: number | null;
  profit_margin_percent: number | null;
  final_price_usd: number | null;
  final_price_bs: number | null;
  seller_name: string | null;
  offer_url: string | null;
  error?: string;
};

type CatalogSyncProduct = {
  variant_id: string;
  product_id: string;
  best_price_usd: number;
  profit_margin_percent: number;
  final_price_usd: number;
  final_price_bs: number;
};

type CatalogSyncSummary = {
  success: true;
  bcv_rate: number;
  updated_at: string;
  products_updated: number;
  products: CatalogSyncProduct[];
};

function calculateTieredPrice(basePriceUsd: number) {
  const marginPercent = basePriceUsd < 20 ? 33 : basePriceUsd < 50 ? 20 : 8;
  const serviceBufferUsd = basePriceUsd < 20 ? 0.4 : 0;
  const finalPriceUsd = Number((basePriceUsd * (1 + marginPercent / 100) + serviceBufferUsd).toFixed(2));
  return { marginPercent, finalPriceUsd };
}

function calculatePriceBs(finalPriceUsd: number, bcvRate: number) {
  return Number((finalPriceUsd * bcvRate).toFixed(2));
}

function jsonResponse(body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
}

function parseCatalogSyncSummary(value: unknown): CatalogSyncSummary {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Supabase devolvió una respuesta inválida al sincronizar el catálogo.');
  }

  const summary = value as Record<string, unknown>;
  if (
    summary.success !== true
    || typeof summary.bcv_rate !== 'number'
    || typeof summary.updated_at !== 'string'
    || typeof summary.products_updated !== 'number'
    || !Number.isInteger(summary.products_updated)
    || summary.products_updated < 0
    || !Array.isArray(summary.products)
    || summary.products.length !== summary.products_updated
  ) {
    throw new Error('Supabase no confirmó la actualización atómica del catálogo.');
  }

  const products = summary.products.map((product): CatalogSyncProduct => {
    if (typeof product !== 'object' || product === null || Array.isArray(product)) {
      throw new Error('Supabase devolvió un producto inválido en el resumen de sincronización.');
    }

    const row = product as Record<string, unknown>;
    if (
      typeof row.variant_id !== 'string'
      || typeof row.product_id !== 'string'
      || typeof row.best_price_usd !== 'number'
      || typeof row.profit_margin_percent !== 'number'
      || typeof row.final_price_usd !== 'number'
      || typeof row.final_price_bs !== 'number'
    ) {
      throw new Error('Supabase devolvió precios inválidos en el resumen de sincronización.');
    }

    return {
      variant_id: row.variant_id,
      product_id: row.product_id,
      best_price_usd: row.best_price_usd,
      profit_margin_percent: row.profit_margin_percent,
      final_price_usd: row.final_price_usd,
      final_price_bs: row.final_price_bs,
    };
  });

  return {
    success: true,
    bcv_rate: summary.bcv_rate,
    updated_at: summary.updated_at,
    products_updated: summary.products_updated,
    products,
  };
}

async function resolveBcvRate() {
  return fetchMontosveRate(process.env.MONTOSVE_API_KEY || '');
}

async function syncEnebaProducts(
  supabase: ReturnType<typeof getSupabaseServerClient> | null,
  bcvRate: number,
  steamOffer: SupplierCheck | null,
  checkedAt: string
): Promise<ProductSyncResult[]> {
  if (!supabase) return [];

  const { data: pricingRows, error: pricingError } = await supabase
    .from('product_pricing')
    .select('variant_id, product_id');
  if (pricingError) throw pricingError;

  const { data: enebaRows, error: enebaError } = await supabase
    .from('product_supplier_urls')
    .select('variant_id, url')
    .eq('supplier', 'eneba');
  if (enebaError) throw enebaError;

  const enebaUrls = new Map((enebaRows ?? [])
    .filter((row) => typeof row.url === 'string' && row.url.trim().length > 0)
    .map((row) => [row.variant_id, row.url]));
  const configuredProducts = (pricingRows ?? []).filter((product) => enebaUrls.has(product.variant_id));
  const results = await Promise.all(configuredProducts.map(async (product): Promise<ProductSyncResult> => {
    const url = enebaUrls.get(product.variant_id);
    const result: ProductSyncResult = {
      success: false,
      variant_id: product.variant_id,
      product_id: product.product_id,
      provider: 'Eneba',
      best_price_usd: null,
      profit_margin_percent: null,
      final_price_usd: null,
      final_price_bs: null,
      seller_name: null,
      offer_url: null,
    };

    try {
      const hasCachedSteamOffer = product.variant_id === VARIANT_ID && steamOffer?.price_usd != null;
      const offer = hasCachedSteamOffer && steamOffer
        ? {
          priceUsd: steamOffer.price_usd,
          sellerName: steamOffer.seller_name,
          offerUrl: steamOffer.offer_url ?? url,
        }
        : await fetchSupplierOffer({ supplier: 'eneba', url });
      const { marginPercent, finalPriceUsd } = calculateTieredPrice(offer.priceUsd);
      const finalPriceBs = calculatePriceBs(finalPriceUsd, bcvRate);
      Object.assign(result, {
        success: true,
        best_price_usd: offer.priceUsd,
        profit_margin_percent: marginPercent,
        final_price_usd: finalPriceUsd,
        final_price_bs: finalPriceBs,
        seller_name: offer.sellerName,
        offer_url: offer.offerUrl,
      });

      if (!hasCachedSteamOffer) {
        const { error: checkError } = await supabase
          .from('supplier_price_checks')
          .insert({
            variant_id: product.variant_id,
            supplier: 'eneba',
            source_url: url,
            price_usd: offer.priceUsd,
            final_price_usd: finalPriceUsd,
            seller_name: offer.sellerName,
            offer_url: offer.offerUrl,
            error: null,
            checked_at: checkedAt,
          });
        if (checkError) throw checkError;
      }

    } catch (error) {
      result.success = false;
      result.error = getErrorMessage(error, 'No se pudo sincronizar el precio.');
      console.error(`[cron/test-steam][product:${product.variant_id}] No se pudo sincronizar:`, error);
    }
    return result;
  }));
  return results;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return jsonResponse({
      success: false,
      bcv_rate: null,
      product: PRODUCT_NAME,
      best_price_usd: null,
      provider: null,
      error: 'No autorizado.',
    });
  }

  let bcvRate: number | null = null;
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    let supabase: ReturnType<typeof getSupabaseServerClient> | null = null;
    let suppliers: SupplierRow[] = FALLBACK_SUPPLIERS;
    let shouldPersistSupplierFallback = false;
    try {
      supabase = getSupabaseServerClient();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo inicializar Supabase.';
      errors.push(`Supabase cliente: ${message}`);
      console.error('[cron/test-steam][supabase-client] No se pudo inicializar Supabase:', error);
    }

    if (supabase) {
      try {
        const { data, error: suppliersError } = await supabase
          .from('product_supplier_urls')
          .select('supplier, url')
          .eq('variant_id', VARIANT_ID)
          .in('supplier', ['eneba', 'g2a']);

        if (suppliersError) throw suppliersError;

        const configuredSuppliers = (data ?? []) as SupplierRow[];
        const supplierByName = new Map(configuredSuppliers.map((supplier) => [supplier.supplier, supplier]));
        suppliers = FALLBACK_SUPPLIERS.map((fallback) => supplierByName.get(fallback.supplier) ?? fallback);
        shouldPersistSupplierFallback = configuredSuppliers.length < FALLBACK_SUPPLIERS.length;

        if (configuredSuppliers.length === 0) {
          warnings.push(`No hay URLs configuradas para ${VARIANT_ID}; se usarán las URLs de respaldo.`);
          console.warn(`[cron/test-steam][supplier-config] Sin filas para ${VARIANT_ID}; usando URLs Eneba/G2A de respaldo.`);
        } else if (configuredSuppliers.length < FALLBACK_SUPPLIERS.length) {
          warnings.push('La configuración de proveedores estaba incompleta; se completó con URLs de respaldo.');
          console.warn('[cron/test-steam][supplier-config] Faltaban proveedores configurados; se completará la lista.');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudieron leer ni guardar las URLs.';
        console.error('[cron/test-steam][supplier-config] Falló la consulta o persistencia de URLs:', error);
        warnings.push(`No se pudieron leer las URLs de Supabase (${message}); se usarán URLs de respaldo.`);
        suppliers = FALLBACK_SUPPLIERS;
        shouldPersistSupplierFallback = true;
      }

      if (shouldPersistSupplierFallback) {
        try {
          const { error: defaultsError } = await supabase
            .from('product_supplier_urls')
            .upsert(suppliers, { onConflict: 'variant_id,supplier' });
          if (defaultsError) throw defaultsError;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'No se pudieron guardar las URLs de respaldo.';
          errors.push(`Persistencia de URLs de respaldo: ${message}`);
          console.error('[cron/test-steam][supplier-config-save] No se pudieron persistir las URLs de respaldo:', error);
        }
      }
    }

    const checkedAt = new Date().toISOString();
    try {
      bcvRate = await resolveBcvRate();
    } catch (error) {
      const message = getErrorMessage(error, 'No se pudo obtener una tasa BCV válida de MontosVE.');
      console.error('[cron/test-steam][bcv] Falló la obtención de la tasa oficial:', error);
      return jsonResponse({
        success: false,
        bcv_rate: null,
        source: 'monedasve_api',
        timestamp: checkedAt,
        products_updated: 0,
        products: [],
        error: message,
      });
    }

    const results = await Promise.all(suppliers.map(async (supplier): Promise<SupplierCheck> => {
        try {
          const offer = await fetchSupplierOffer(supplier);
          return {
            variant_id: VARIANT_ID,
            supplier: supplier.supplier,
            source_url: supplier.url,
            price_usd: offer.priceUsd,
            final_price_usd: calculateTieredPrice(offer.priceUsd).finalPriceUsd,
            seller_name: offer.sellerName,
            offer_url: offer.offerUrl,
            error: null,
            checked_at: checkedAt,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Error desconocido consultando al proveedor.';
          console.error(`[cron/test-steam][supplier:${supplier.supplier}] Falló la extracción de oferta:`, error);
          return {
            variant_id: VARIANT_ID,
            supplier: supplier.supplier,
            source_url: supplier.url,
            price_usd: null,
            final_price_usd: null,
            seller_name: null,
            offer_url: null,
            error: message,
            checked_at: checkedAt,
          };
        }
      }));

    if (supabase && results.length > 0) {
      try {
        const { error: saveError } = await supabase
          .from('supplier_price_checks')
          .insert(
            results.map((result) => ({
              variant_id: result.variant_id,
              supplier: result.supplier,
              source_url: result.source_url,
              price_usd: result.price_usd,
              final_price_usd: result.final_price_usd,
              seller_name: result.seller_name,
              offer_url: result.offer_url,
              error: result.error,
              checked_at: result.checked_at,
            }))
          );
        if (saveError) throw saveError;
      } catch (error) {
        const message = getErrorMessage(error, 'No se pudieron guardar los precios.');
        errors.push(`Guardado de ofertas: ${message}`);
        console.error('[cron/test-steam][offer-save] Falló la inserción en supplier_price_checks:', error);
      }
    }

    const best = results.find((result) => result.supplier === 'eneba' && result.price_usd !== null) ?? null;
    const comparisonComplete = results.length === FALLBACK_SUPPLIERS.length
      && FALLBACK_SUPPLIERS.every((supplier) => results.some((result) => result.supplier === supplier.supplier && result.price_usd !== null));

    if (!comparisonComplete) {
      warnings.push('Comparación Eneba/G2A incompleta; el precio de producto se calculará únicamente desde Eneba.');
      console.warn('[cron/test-steam][comparison] Comparación incompleta; el precio sincronizado usará Eneba.');
    }

    let finalPriceUsd: number | null = null;
    let finalPriceBs: number | null = null;
    let profitMarginPercent: number | null = null;

    if (best) {
      try {
        const tieredPrice = calculateTieredPrice(best.price_usd!);
        profitMarginPercent = tieredPrice.marginPercent;
        finalPriceUsd = tieredPrice.finalPriceUsd;
        if (bcvRate !== null) finalPriceBs = calculatePriceBs(finalPriceUsd, bcvRate);
        if (bcvRate === null) warnings.push('No se pudo calcular el precio en Bs. por falta de tasa BCV.');
      } catch (error) {
        const message = getErrorMessage(error, 'No se pudo guardar el precio calculado.');
        warnings.push(`No se pudo persistir el precio calculado: ${message}`);
        console.error('[cron/test-steam][price-save] Falló la actualización de precio/margen/BCV:', error);
      }
    } else {
      console.error('[cron/test-steam][calculation] Sin comparación completa; no se calcula el precio final.');
    }

    const fetchedProducts = await syncEnebaProducts(
      supabase,
      bcvRate,
      results.find((result) => result.supplier === 'eneba') ?? null,
      checkedAt
    );
    for (const product of fetchedProducts) {
      if (!product.success) {
        errors.push(`${product.variant_id}: ${product.error ?? 'No se pudo actualizar.'}`);
      }
    }

    if (!supabase) {
      throw new Error('Supabase no está disponible; no se modificó la tasa ni el catálogo.');
    }

    const { data: syncData, error: syncError } = await supabase.rpc('sync_catalog_prices_with_bcv', {
      p_bcv_rate: bcvRate,
      p_updated_at: checkedAt,
      p_supplier_prices: fetchedProducts
        .filter((product) => product.success && product.best_price_usd !== null)
        .map((product) => ({
          variant_id: product.variant_id,
          cost_usd: product.best_price_usd,
          supplier: 'eneba',
          seller_name: product.seller_name,
          offer_url: product.offer_url,
        })),
    });
    if (syncError) throw syncError;
    const syncSummary = parseCatalogSyncSummary(syncData);

    return jsonResponse({
      success: syncSummary.products_updated > 0,
      bcv_rate: bcvRate,
      source: 'monedasve_api',
      timestamp: checkedAt,
      bcv_rate_persisted: true,
      product: PRODUCT_NAME,
      best_price_usd: best?.price_usd ?? null,
      provider: best
        ? `${PROVIDER_NAMES[best.supplier]}${best.seller_name ? ` - ${best.seller_name}` : ''}`
        : null,
      provider_url: best?.offer_url ?? null,
      profit_margin_percent: profitMarginPercent,
      final_price_usd: finalPriceUsd,
      final_price_bs: finalPriceBs,
      products_updated: syncSummary.products_updated,
      products: syncSummary.products,
      failed_supplier_checks: fetchedProducts
        .filter((product) => !product.success)
        .map((product) => ({
          variant_id: product.variant_id,
          error: product.error,
        })),
      comparisons: results.map((result) => ({
        provider: PROVIDER_NAMES[result.supplier],
        price_usd: result.price_usd,
        final_price_usd: result.final_price_usd,
        seller_name: result.seller_name,
        offer_url: result.offer_url,
        status: result.price_usd === null ? 'no disponible' : 'disponible',
        ...(result.error ? { error: result.error } : {}),
      })),
      ...(warnings.length > 0 ? { warnings } : {}),
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (error) {
    console.error('Error al probar precios de Steam Gift Card $10:', error);
    return jsonResponse({
      success: false,
      bcv_rate: bcvRate,
      source: 'monedasve_api',
      timestamp: new Date().toISOString(),
      products_updated: 0,
      products: [],
      product: PRODUCT_NAME,
      best_price_usd: null,
      provider: null,
      error: error instanceof Error ? error.message : 'No se pudo completar la prueba de Steam.',
    });
  }
}
