import { NextResponse } from 'next/server';
import { refreshBcvRate } from '../../../lib/pricing/bcv';
import { fetchSupplierOffer, fetchSupplierPrice, type SupplierName } from '../../../lib/pricing/suppliers';
import { getSupabaseServerClient, requireAdmin } from '../../../lib/supabase/server';

export const runtime = 'nodejs';

type SupplierRow = {
  supplier: SupplierName;
  url: string;
};

type SupplierResult = SupplierRow & {
  price_usd: number | null;
  seller_name: string | null;
  offer_url: string | null;
  error: string | null;
};

type PricingRow = {
  variant_id: string;
  product_id: string;
  profit_margin_percent: number;
  fallback_cost_usd: number | null;
};

export async function POST(request: Request) {
  let body: { variantId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'El cuerpo debe ser JSON válido.' }, { status: 400 });
  }

  if (typeof body.variantId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.variantId)) {
    return NextResponse.json({ error: 'variantId no es válido.' }, { status: 400 });
  }

  try {
    const { user, error: authError } = await requireAdmin(request);
    if (!user) return NextResponse.json({ error: authError }, { status: 401 });

    const supabase = getSupabaseServerClient();
    const { data: pricing, error: pricingError } = await supabase
      .from('product_pricing')
      .select('variant_id, product_id, profit_margin_percent, fallback_cost_usd')
      .eq('variant_id', body.variantId)
      .maybeSingle();

    if (pricingError) throw pricingError;
    if (!pricing) return NextResponse.json({ error: 'No hay configuración de precio para esta variante.' }, { status: 404 });

    const suppliersQuery = supabase
      .from('product_supplier_urls')
      .select('supplier, url')
      .eq('variant_id', body.variantId);
    if (body.variantId === 'v-s10-glo') suppliersQuery.in('supplier', ['eneba', 'g2a']);
    const { data: suppliers, error: suppliersError } = await suppliersQuery;

    if (suppliersError) throw suppliersError;

    const results: SupplierResult[] = await Promise.all((suppliers as SupplierRow[]).map(async (supplier) => {
      try {
        const offer = body.variantId === 'v-s10-glo'
          ? await fetchSupplierOffer(supplier)
          : null;
        const priceUsd = offer?.priceUsd ?? await fetchSupplierPrice(supplier);
        return {
          ...supplier,
          price_usd: priceUsd,
          seller_name: offer?.sellerName ?? null,
          offer_url: offer?.offerUrl ?? supplier.url,
          error: null,
        };
      } catch (error) {
        return {
          ...supplier,
          price_usd: null,
          seller_name: null,
          offer_url: null,
          error: error instanceof Error ? error.message : 'Error desconocido consultando al proveedor.',
        };
      }
    }));

    const { error: saveError } = await supabase
      .from('supplier_price_checks')
      .upsert(
        results.map((result) => ({
          variant_id: body.variantId,
          supplier: result.supplier,
          source_url: result.url,
          price_usd: result.price_usd,
          seller_name: result.seller_name,
          offer_url: result.offer_url,
          error: result.error,
          checked_at: new Date().toISOString(),
        })),
        { onConflict: 'variant_id,supplier' }
      );

    if (saveError) throw saveError;

    const successfulPrices = results.filter((result) => result.price_usd !== null);
    const cheapest = successfulPrices.reduce<(typeof successfulPrices)[number] | null>(
      (best, current) => !best || current.price_usd! < best.price_usd! ? current : best,
      null
    );
    const steamComparisonComplete = body.variantId !== 'v-s10-glo'
      || (results.length === 2 && results.every((result) => result.price_usd !== null));
    const baseCostUsd = body.variantId === 'v-s10-glo'
      ? (steamComparisonComplete ? cheapest?.price_usd ?? null : null)
      : cheapest?.price_usd ?? pricing.fallback_cost_usd;
    if (baseCostUsd === null) {
      return NextResponse.json({
        error: 'No se pudo leer ningún precio y no hay un costo de respaldo configurado.',
        product_id: pricing.product_id,
        variant_id: pricing.variant_id,
        comparisons: results,
        cheapest_supplier: null,
        cheapest_seller_name: null,
        cheapest_url: null,
        cheapest_base_usd: null,
        profit_margin_percent: Number(pricing.profit_margin_percent),
        final_usd: null,
        bcv_rate: null,
        final_bs: null,
        used_fallback: false,
      }, { status: 502 });
    }

    const { rate } = await refreshBcvRate();

    const finalUsd = Number((baseCostUsd * (1 + Number(pricing.profit_margin_percent) / 100)).toFixed(2));
    const finalBs = Math.ceil(finalUsd * rate);
    if (body.variantId === 'v-s10-glo' && cheapest) {
      const { error: priceSaveError } = await supabase
        .from('product_pricing')
        .update({
          current_supplier: cheapest.supplier,
          current_seller_name: cheapest.seller_name,
          current_offer_url: cheapest.offer_url,
          current_cost_usd: cheapest.price_usd,
          final_price_usd: finalUsd,
          final_price_bs: finalBs,
          bcv_rate: rate,
          applied_margin_percent: Number(pricing.profit_margin_percent),
          price_checked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('variant_id', body.variantId);
      if (priceSaveError) throw priceSaveError;
    }

    return NextResponse.json({
      product_id: pricing.product_id,
      variant_id: pricing.variant_id,
      comparisons: results,
      cheapest_supplier: cheapest?.supplier ?? null,
      cheapest_seller_name: cheapest?.seller_name ?? null,
      cheapest_url: cheapest?.offer_url ?? cheapest?.url ?? null,
      cheapest_base_usd: baseCostUsd,
      profit_margin_percent: Number(pricing.profit_margin_percent),
      final_usd: finalUsd,
      bcv_rate: rate,
      final_bs: finalBs,
      used_fallback: cheapest === null,
    });
  } catch (error) {
    console.error('Error al comparar precios de proveedores:', error);
    return NextResponse.json({ error: 'No se pudo completar la comparación de precios.' }, { status: 500 });
  }
}
