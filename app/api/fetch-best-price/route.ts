import { NextResponse } from 'next/server';
import { fetchSupplierPrice, type SupplierName } from '../../../lib/pricing/suppliers';
import { getSupabaseServerClient, requireAdmin } from '../../../lib/supabase/server';

export const runtime = 'nodejs';

type SupplierRow = {
  supplier: SupplierName;
  url: string;
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

    const { data: suppliers, error: suppliersError } = await supabase
      .from('product_supplier_urls')
      .select('supplier, url')
      .eq('variant_id', body.variantId);

    if (suppliersError) throw suppliersError;

    const results = await Promise.all((suppliers as SupplierRow[]).map(async (supplier) => {
      try {
        const priceUsd = await fetchSupplierPrice(supplier);
        return { ...supplier, price_usd: priceUsd, error: null };
      } catch (error) {
        return {
          ...supplier,
          price_usd: null,
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
    const baseCostUsd = cheapest?.price_usd ?? pricing.fallback_cost_usd;
    if (baseCostUsd === null) {
      return NextResponse.json({
        error: 'No se pudo leer ningún precio y no hay un costo de respaldo configurado.',
        product_id: pricing.product_id,
        variant_id: pricing.variant_id,
        comparisons: results,
        cheapest_supplier: null,
        cheapest_url: null,
        cheapest_base_usd: null,
        profit_margin_percent: Number(pricing.profit_margin_percent),
        final_usd: null,
        bcv_rate: null,
        final_bs: null,
        used_fallback: false,
      }, { status: 502 });
    }

    const rateResponse = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { cache: 'no-store' });
    if (!rateResponse.ok) throw new Error(`La API BCV respondió con el estado ${rateResponse.status}.`);
    const rateData: unknown = await rateResponse.json();
    if (
      typeof rateData !== 'object'
      || rateData === null
      || !('promedio' in rateData)
      || typeof rateData.promedio !== 'number'
      || !Number.isFinite(rateData.promedio)
      || rateData.promedio <= 0
    ) {
      throw new Error('La API BCV no devolvió una tasa válida.');
    }

    const finalUsd = Number((baseCostUsd * (1 + Number(pricing.profit_margin_percent) / 100)).toFixed(2));
    return NextResponse.json({
      product_id: pricing.product_id,
      variant_id: pricing.variant_id,
      comparisons: results,
      cheapest_supplier: cheapest?.supplier ?? null,
      cheapest_url: cheapest?.url ?? null,
      cheapest_base_usd: baseCostUsd,
      profit_margin_percent: Number(pricing.profit_margin_percent),
      final_usd: finalUsd,
      bcv_rate: rateData.promedio,
      final_bs: Math.ceil(finalUsd * rateData.promedio),
      used_fallback: cheapest === null,
    });
  } catch (error) {
    console.error('Error al comparar precios de proveedores:', error);
    return NextResponse.json({ error: 'No se pudo completar la comparación de precios.' }, { status: 500 });
  }
}
