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

type SupplierRow = {
  supplier: SupplierName;
  url: string;
};

type PricingRow = {
  profit_margin_percent: number;
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

  try {
    let supabase: ReturnType<typeof getSupabaseServerClient> | null = null;
    let suppliers: SupplierRow[] = [];
    let pricingConfig: PricingRow | null = null;
    try {
      supabase = getSupabaseServerClient();
      const { data: pricing, error: pricingError } = await supabase
        .from('product_pricing')
        .select('variant_id, product_id, profit_margin_percent')
        .eq('variant_id', VARIANT_ID)
        .eq('product_id', PRODUCT_ID)
        .maybeSingle();

      if (pricingError) throw pricingError;
      if (!pricing) throw new Error('No existe la configuración de Steam Gift Card $10.');
      pricingConfig = pricing as PricingRow;

      const { data, error: suppliersError } = await supabase
        .from('product_supplier_urls')
        .select('supplier, url')
        .eq('variant_id', VARIANT_ID)
        .in('supplier', ['eneba', 'g2a']);

      if (suppliersError) throw suppliersError;
      suppliers = (data ?? []) as SupplierRow[];
      if (suppliers.length === 0) throw new Error('No hay proveedores configurados para Steam Gift Card $10.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar los proveedores.';
      errors.push(`Configuración: ${message}`);
      console.error('Error al cargar proveedores para la prueba de Steam:', error);
    }

    const checkedAt = new Date().toISOString();
    const [rateResult, results] = await Promise.all([
      refreshBcvRate()
        .then(({ rate }) => ({ rate }))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'No se pudo actualizar la tasa BCV.';
          errors.push(`BCV: ${message}`);
          console.error('Error al actualizar la tasa BCV para la prueba de Steam:', error);
          return { rate: null };
        }),
      Promise.all(suppliers.map(async (supplier): Promise<SupplierCheck> => {
        try {
          const offer = await fetchSupplierOffer(supplier);
          return {
            variant_id: VARIANT_ID,
            supplier: supplier.supplier,
            source_url: supplier.url,
            price_usd: offer.priceUsd,
            seller_name: offer.sellerName,
            offer_url: offer.offerUrl,
            error: null,
            checked_at: checkedAt,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Error desconocido consultando al proveedor.';
          console.error(`Error al consultar ${supplier.supplier} para la prueba de Steam:`, error);
          return {
            variant_id: VARIANT_ID,
            supplier: supplier.supplier,
            source_url: supplier.url,
            price_usd: null,
            seller_name: null,
            offer_url: null,
            error: message,
            checked_at: checkedAt,
          };
        }
      })),
    ]);
    bcvRate = rateResult.rate;

    if (supabase && results.length > 0) {
      try {
        const { error: saveError } = await supabase
          .from('supplier_price_checks')
          .upsert(results, { onConflict: 'variant_id,supplier' });
        if (saveError) throw saveError;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudieron guardar los precios.';
        errors.push(`Supabase: ${message}`);
        console.error('Error al guardar precios para la prueba de Steam:', error);
      }
    }

    const availableBest = results.reduce<SupplierCheck | null>(
      (currentBest, current) => current.price_usd === null
        ? currentBest
        : currentBest === null || current.price_usd < currentBest.price_usd
          ? current
          : currentBest,
      null
    );
    const comparisonComplete = results.length === 2 && results.every((result) => result.price_usd !== null);
    const best = comparisonComplete ? availableBest : null;

    if (!comparisonComplete) {
      errors.push('La comparación Eneba/G2A está incompleta; no se actualizó el precio de la tienda.');
    }

    let finalPriceUsd: number | null = null;
    let finalPriceBs: number | null = null;
    let profitMarginPercent: number | null = null;
    if (best && bcvRate !== null && supabase && pricingConfig) {
      try {
        profitMarginPercent = Number(pricingConfig.profit_margin_percent);
        finalPriceUsd = Number((best.price_usd! * (1 + profitMarginPercent / 100)).toFixed(2));
        finalPriceBs = Math.ceil(finalPriceUsd * bcvRate);
        const { error: updateError } = await supabase
          .from('product_pricing')
          .update({
            current_supplier: best.supplier,
            current_seller_name: best.seller_name,
            current_offer_url: best.offer_url,
            current_cost_usd: best.price_usd,
            final_price_usd: finalPriceUsd,
            final_price_bs: finalPriceBs,
            bcv_rate: bcvRate,
            applied_margin_percent: profitMarginPercent,
            price_checked_at: checkedAt,
            updated_at: checkedAt,
          })
          .eq('variant_id', VARIANT_ID);
        if (updateError) throw updateError;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo guardar el precio calculado.';
        errors.push(`Precio calculado: ${message}`);
        console.error('Error al guardar el precio calculado de Steam:', error);
      }
    } else if (!best) {
      errors.push('No hay precios elegibles para calcular el precio final.');
    } else if (bcvRate === null) {
      errors.push('No se calculó el precio final porque la tasa BCV no está disponible.');
    }

    return jsonResponse({
      success: errors.length === 0 && best !== null && bcvRate !== null && finalPriceBs !== null,
      bcv_rate: bcvRate,
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
        seller_name: result.seller_name,
        offer_url: result.offer_url,
        status: result.price_usd === null ? 'no disponible' : 'disponible',
      })),
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (error) {
    console.error('Error al probar precios de Steam Gift Card $10:', error);
    return jsonResponse({
      success: false,
      bcv_rate: bcvRate,
      product: PRODUCT_NAME,
      best_price_usd: null,
      provider: null,
      error: error instanceof Error ? error.message : 'No se pudo completar la prueba de Steam.',
    });
  }
}
