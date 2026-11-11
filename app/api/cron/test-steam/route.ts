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
  const finalPriceUsd = Number((basePriceUsd * (1 + marginPercent / 100)).toFixed(2));
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

async function checkSteamSuppliers(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  checkedAt: string
): Promise<{ checks: SupplierCheck[]; warnings: string[] }> {
  const warnings: string[] = [];
  let suppliers = FALLBACK_SUPPLIERS;

  try {
    const { data, error } = await supabase
      .from('product_supplier_urls')
      .select('supplier, url')
      .eq('variant_id', VARIANT_ID)
      .in('supplier', ['eneba', 'g2a']);
    if (error) throw error;

    const configuredSuppliers = (data ?? []) as SupplierRow[];
    const supplierByName = new Map(configuredSuppliers.map((supplier) => [supplier.supplier, supplier]));
    suppliers = FALLBACK_SUPPLIERS.map((fallback) => supplierByName.get(fallback.supplier) ?? fallback);
  } catch (error) {
    warnings.push(`No se pudo leer la configuración de ofertas Steam; se usarán URLs de respaldo: ${getErrorMessage(error, 'error desconocido')}`);
    console.warn('[cron/test-steam][supplier-config] Se usarán URLs de respaldo:', error);
  }

  const checks = await Promise.all(suppliers.map(async (supplier): Promise<SupplierCheck> => {
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
      const message = getErrorMessage(error, 'Error desconocido consultando al proveedor.');
      warnings.push(`${PROVIDER_NAMES[supplier.supplier]}: ${message}`);
      console.warn(`[cron/test-steam][supplier:${supplier.supplier}] Falló la prueba secundaria:`, error);
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

  try {
    const { error } = await supabase
      .from('supplier_price_checks')
      .insert(checks.map((check) => ({
        variant_id: check.variant_id,
        supplier: check.supplier,
        source_url: check.source_url,
        price_usd: check.price_usd,
        final_price_usd: check.final_price_usd,
        seller_name: check.seller_name,
        offer_url: check.offer_url,
        error: check.error,
        checked_at: check.checked_at,
      })));
    if (error) throw error;
  } catch (error) {
    warnings.push(`No se pudo guardar el historial de prueba Steam: ${getErrorMessage(error, 'error desconocido')}`);
    console.warn('[cron/test-steam][offer-save] No se guardó el historial de la prueba secundaria:', error);
  }

  return { checks, warnings };
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
  const warnings: string[] = [];

  try {
    const checkedAt = new Date().toISOString();
    const supabase = getSupabaseServerClient();
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

    const { data: syncData, error: syncError } = await supabase.rpc('sync_exchange_rate_and_recalculate_catalog', {
      p_bcv_rate: bcvRate,
      p_updated_at: checkedAt,
      p_supplier_prices: [],
    });
    if (syncError) throw syncError;
    const syncSummary = parseCatalogSyncSummary(syncData);

    let results: SupplierCheck[] = [];
    try {
      const secondaryResult = await checkSteamSuppliers(supabase, checkedAt);
      warnings.push(...secondaryResult.warnings);
      results = secondaryResult.checks;
    } catch (error) {
      warnings.push(`Falló la prueba secundaria de Steam: ${getErrorMessage(error, 'error desconocido')}`);
      console.warn('[cron/test-steam][secondary-check] Falló la prueba secundaria:', error);
    }

    const best = results.find((result) => result.supplier === 'eneba' && result.price_usd !== null) ?? null;
    const comparisonComplete = results.length === FALLBACK_SUPPLIERS.length
      && FALLBACK_SUPPLIERS.every((supplier) => results.some((result) => result.supplier === supplier.supplier && result.price_usd !== null));

    if (!comparisonComplete) {
      warnings.push('La prueba de ofertas Steam quedó incompleta; el recálculo atómico del catálogo ya se completó.');
      console.warn('[cron/test-steam][comparison] La prueba secundaria no completó la comparación de ofertas.');
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

    return jsonResponse({
      success: true,
      bcv_rate: bcvRate,
      source: 'monedasve_api',
      timestamp: checkedAt,
      bcv_rate_persisted: true,
      catalog_recalculated: true,
      catalog_products_updated: syncSummary.products_updated,
      catalog_products: syncSummary.products,
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
