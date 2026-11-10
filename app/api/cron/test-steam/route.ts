import { NextResponse } from 'next/server';
import { refreshBcvRate } from '../../../../lib/pricing/bcv';
import { fetchSupplierPrice, type SupplierName } from '../../../../lib/pricing/suppliers';
import { getSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

const VARIANT_ID = 'v-s10-glo';
const PRODUCT_ID = 'g-steam-10';
const PRODUCT_NAME = 'Steam Gift Card $10';

type SupplierRow = {
  supplier: SupplierName;
  url: string;
};

const PROVIDER_NAMES: Record<SupplierName, string> = {
  eneba: 'Eneba',
  g2a: 'G2A',
  eldorado: 'Eldorado',
};

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const { rate } = await refreshBcvRate();
    const supabase = getSupabaseServerClient();
    const { data: pricing, error: pricingError } = await supabase
      .from('product_pricing')
      .select('variant_id, product_id')
      .eq('variant_id', VARIANT_ID)
      .eq('product_id', PRODUCT_ID)
      .maybeSingle();

    if (pricingError) throw pricingError;
    if (!pricing) {
      return NextResponse.json({ error: 'No existe la configuración de Steam Gift Card $10.' }, { status: 404 });
    }

    const { data: suppliers, error: suppliersError } = await supabase
      .from('product_supplier_urls')
      .select('supplier, url')
      .eq('variant_id', VARIANT_ID);

    if (suppliersError) throw suppliersError;
    if (!suppliers?.length) {
      return NextResponse.json({ error: 'No hay proveedores configurados para Steam Gift Card $10.' }, { status: 404 });
    }

    const checkedAt = new Date().toISOString();
    const results = await Promise.all((suppliers as SupplierRow[]).map(async (supplier) => {
      try {
        const price = await fetchSupplierPrice(supplier);
        return {
          variant_id: VARIANT_ID,
          supplier: supplier.supplier,
          source_url: supplier.url,
          price_usd: Number(price.toFixed(2)),
          error: null,
          checked_at: checkedAt,
        };
      } catch (error) {
        return {
          variant_id: VARIANT_ID,
          supplier: supplier.supplier,
          source_url: supplier.url,
          price_usd: null,
          error: error instanceof Error ? error.message : 'Error desconocido consultando al proveedor.',
          checked_at: checkedAt,
        };
      }
    }));

    const { error: saveError } = await supabase
      .from('supplier_price_checks')
      .upsert(results, { onConflict: 'variant_id,supplier' });
    if (saveError) throw saveError;

    const best = results.reduce<(typeof results)[number] | null>(
      (currentBest, current) => current.price_usd === null
        ? currentBest
        : currentBest === null || current.price_usd < currentBest.price_usd
          ? current
          : currentBest,
      null
    );

    if (!best) {
      return NextResponse.json(
        { error: 'No se pudo obtener un precio válido de los proveedores.', comparisons: results },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      bcv_rate: rate,
      product: PRODUCT_NAME,
      best_price_usd: best.price_usd,
      provider: PROVIDER_NAMES[best.supplier],
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error al probar precios de Steam Gift Card $10:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo completar la prueba de Steam.' },
      { status: 502 }
    );
  }
}
