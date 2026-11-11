import { NextResponse } from 'next/server';
import { refreshBcvRate } from '../../../../lib/pricing/bcv';
import { fetchSupplierOffer, type SupplierName } from '../../../../lib/pricing/suppliers';
import { getSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const VARIANT_ID = 'v-s10-glo';
const PRODUCT_ID = 'g-steam-10';
const PRODUCT_NAME = 'Steam Gift Card $10';
const PROFIT_MARGIN_PERCENT = 33;
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
  let bcvRateSource: string | null = null;
  let bcvRateIsStale = false;
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
    const [rateResult, results] = await Promise.all([
      refreshBcvRate()
        .then((result) => {
          if (result.stale) {
            warnings.push('warning' in result ? result.warning : 'Se usó la última tasa BCV guardada.');
            console.warn('[cron/test-steam][bcv] Se usará la tasa BCV guardada en Supabase.');
          }
          return { rate: result.rate, source: result.source, stale: result.stale };
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'No se pudo obtener una tasa BCV válida.';
          errors.push(`Tasa BCV: ${message}`);
          console.error('[cron/test-steam][bcv] No se obtuvo tasa actual ni respaldo:', error);
          return { rate: null, source: null, stale: true };
        }),
      Promise.all(suppliers.map(async (supplier): Promise<SupplierCheck> => {
        try {
          const offer = await fetchSupplierOffer(supplier);
          return {
            variant_id: VARIANT_ID,
            supplier: supplier.supplier,
            source_url: supplier.url,
            price_usd: offer.priceUsd,
            final_price_usd: Number((offer.priceUsd * (1 + PROFIT_MARGIN_PERCENT / 100)).toFixed(2)),
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
      })),
    ]);
    bcvRate = rateResult.rate;
    bcvRateSource = rateResult.source;
    bcvRateIsStale = rateResult.stale;

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

    const availableBest = results.reduce<SupplierCheck | null>(
      (currentBest, current) => current.final_price_usd === null
        ? currentBest
        : currentBest === null || current.final_price_usd < currentBest.final_price_usd!
          ? current
          : currentBest,
      null
    );
    const comparisonComplete = results.length === FALLBACK_SUPPLIERS.length
      && FALLBACK_SUPPLIERS.every((supplier) => results.some((result) => result.supplier === supplier.supplier && result.price_usd !== null));
    const best = availableBest;

    if (!comparisonComplete) {
      warnings.push('Comparación Eneba/G2A incompleta; se usará la mejor oferta válida disponible.');
      console.warn('[cron/test-steam][comparison] Comparación incompleta; se usará la mejor oferta válida disponible.');
    }

    let finalPriceUsd: number | null = null;
    let finalPriceBs: number | null = null;
    let profitMarginPercent: number | null = null;

    if (best) {
      try {
        profitMarginPercent = PROFIT_MARGIN_PERCENT;
        finalPriceUsd = best.final_price_usd!;
        if (bcvRate !== null) finalPriceBs = Number((finalPriceUsd * bcvRate).toFixed(2));
        if (!supabase) {
          warnings.push('Supabase no está disponible; no se pudo persistir el precio calculado.');
        } else {
          const { error: pricingErr } = await supabase
            .from('product_pricing')
            .upsert({
              variant_id: VARIANT_ID,
              current_supplier: best.supplier,
              current_seller_name: best.seller_name,
              current_offer_url: best.offer_url,
              current_cost_usd: best.price_usd,
              applied_margin_percent: PROFIT_MARGIN_PERCENT,
              final_price_usd: finalPriceUsd,
              ...(bcvRate !== null ? { bcv_rate: bcvRate, final_price_bs: finalPriceBs } : {}),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'variant_id' });
          if (pricingErr) throw pricingErr;
        }
        if (bcvRate === null) {
          warnings.push('El precio ganador en USD se guardó, pero no se pudo actualizar su conversión a bolívares.');
          console.error('[cron/test-steam][calculation] Se guardó el precio USD sin conversión por falta de tasa BCV.');
        }
      } catch (error) {
        const message = getErrorMessage(error, 'No se pudo guardar el precio calculado.');
        warnings.push(`No se pudo persistir el precio calculado: ${message}`);
        console.error('[cron/test-steam][price-save] Falló la actualización de precio/margen/BCV:', error);
      }
    } else {
      console.error('[cron/test-steam][calculation] Sin comparación completa; no se calcula el precio final.');
    }

    return jsonResponse({
      success: best !== null && bcvRate !== null && finalPriceBs !== null,
      bcv_rate: bcvRate,
      source: bcvRateSource,
      bcv_rate_stale: bcvRateIsStale,
      product: PRODUCT_NAME,
      best_price_usd: best?.price_usd ?? null,
      provider: best
        ? `${PROVIDER_NAMES[best.supplier]}${best.seller_name ? ` - ${best.seller_name}` : ''}`
        : null,
      provider_url: best?.offer_url ?? null,
      profit_margin_percent: profitMarginPercent,
      final_price_usd: finalPriceUsd,
      final_price_bs: finalPriceBs,
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
      source: bcvRateSource,
      product: PRODUCT_NAME,
      best_price_usd: null,
      provider: null,
      error: error instanceof Error ? error.message : 'No se pudo completar la prueba de Steam.',
    });
  }
}
