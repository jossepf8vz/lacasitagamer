import { NextResponse } from 'next/server';
import { refreshBcvRate } from '../../../../lib/pricing/bcv';
import { fetchSupplierPrice, type SupplierName } from '../../../../lib/pricing/suppliers';
import { getSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

type SupplierCheck = {
  variant_id: string;
  supplier: SupplierName;
  source_url: string;
  price_usd: number | null;
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
    try {
      ({ rate: bcvRate } = await refreshBcvRate());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar la tasa BCV.';
      errors.push(`BCV: ${message}`);
      console.error('Error al actualizar la tasa BCV para la prueba de Steam:', error);
    }

    let supabase: ReturnType<typeof getSupabaseServerClient> | null = null;
    let suppliers: SupplierRow[] = [];
    try {
      supabase = getSupabaseServerClient();
      const { data: pricing, error: pricingError } = await supabase
        .from('product_pricing')
        .select('variant_id, product_id')
        .eq('variant_id', VARIANT_ID)
        .eq('product_id', PRODUCT_ID)
        .maybeSingle();

      if (pricingError) throw pricingError;
      if (!pricing) throw new Error('No existe la configuración de Steam Gift Card $10.');

      const { data, error: suppliersError } = await supabase
        .from('product_supplier_urls')
        .select('supplier, url')
        .eq('variant_id', VARIANT_ID);

      if (suppliersError) throw suppliersError;
      suppliers = (data ?? []) as SupplierRow[];
      if (suppliers.length === 0) throw new Error('No hay proveedores configurados para Steam Gift Card $10.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar los proveedores.';
      errors.push(`Configuración: ${message}`);
      console.error('Error al cargar proveedores para la prueba de Steam:', error);
    }

    const checkedAt = new Date().toISOString();
    const results: SupplierCheck[] = await Promise.all(suppliers.map(async (supplier) => {
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
        const message = error instanceof Error ? error.message : 'Error desconocido consultando al proveedor.';
        console.error(`Error al consultar ${supplier.supplier} para la prueba de Steam:`, error);
        return {
          variant_id: VARIANT_ID,
          supplier: supplier.supplier,
          source_url: supplier.url,
          price_usd: null,
          error: message,
          checked_at: checkedAt,
        };
      }
    }));

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

    const best = results.reduce<SupplierCheck | null>(
      (currentBest, current) => current.price_usd === null
        ? currentBest
        : currentBest === null || current.price_usd < currentBest.price_usd
          ? current
          : currentBest,
      null
    );

    if (!best && results.length > 0) {
      errors.push('No se obtuvo un precio válido de los proveedores.');
    }

    return jsonResponse({
      success: errors.length === 0 && best !== null && bcvRate !== null,
      bcv_rate: bcvRate,
      product: PRODUCT_NAME,
      best_price_usd: best?.price_usd ?? null,
      provider: best ? PROVIDER_NAMES[best.supplier] : null,
      comparisons: results.map((result) => ({
        provider: PROVIDER_NAMES[result.supplier],
        price_usd: result.price_usd,
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
