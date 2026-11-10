import { NextResponse } from 'next/server';
import { refreshBcvRate } from '../../../lib/pricing/bcv';
import { getSupabaseServerClient } from '../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PricingRow = {
  variant_id: string;
  profit_margin_percent: number;
  fallback_cost_usd: number | null;
  final_price_usd: number | null;
  final_price_bs: number | null;
  applied_margin_percent: number | null;
};

type PriceCheckRow = {
  variant_id: string;
  supplier: string;
  price_usd: number | null;
  checked_at: string;
};

function getErrorDetails(error: unknown): Record<string, unknown> {
  if (typeof error !== 'object' || error === null) {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  const details: Record<string, unknown> = {};
  for (const key of ['message', 'code', 'details', 'hint']) {
    if (key in error) details[key] = (error as Record<string, unknown>)[key];
  }
  return details;
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('variants');
  const variantIds = Array.from(new Set((query ?? '').split(',').filter(Boolean)));
  if (variantIds.length === 0 || variantIds.length > 100 || variantIds.some((id) => !/^[a-zA-Z0-9_-]{1,100}$/.test(id))) {
    return NextResponse.json({ error: 'Se requiere una lista válida de 1 a 100 variantes.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    let pricingRows: PricingRow[];
    try {
      const { data, error } = await supabase
        .from('product_pricing')
        .select('variant_id, profit_margin_percent, fallback_cost_usd, final_price_usd, final_price_bs, applied_margin_percent')
        .in('variant_id', variantIds);

      if (error) throw error;
      pricingRows = (data ?? []) as PricingRow[];
    } catch (error) {
      console.error('[api/product-prices][product_pricing] Falló la consulta principal.', {
        table: 'product_pricing',
        columns: ['variant_id', 'profit_margin_percent', 'fallback_cost_usd', 'final_price_usd', 'final_price_bs', 'applied_margin_percent'],
        filter: { variant_id: variantIds },
        error: getErrorDetails(error),
      });
      return NextResponse.json({ error: 'No se pudieron cargar los precios configurados.' }, { status: 500 });
    }

    let checks: PriceCheckRow[] = [];
    let checksUnavailable = false;
    const warnings: string[] = [];
    try {
      const { data, error } = await supabase
        .from('supplier_price_checks')
        .select('variant_id, supplier, price_usd, checked_at')
        .in('variant_id', variantIds)
        .not('price_usd', 'is', null)
        .order('checked_at', { ascending: false });

      if (error) throw error;
      checks = (data ?? []) as PriceCheckRow[];
    } catch (error) {
      checksUnavailable = true;
      warnings.push('No se pudieron cargar las ofertas de proveedores; se muestran los precios guardados disponibles.');
      console.error('[api/product-prices][supplier_price_checks] Falló la consulta secundaria; se continuará con product_pricing.', {
        table: 'supplier_price_checks',
        columns: ['variant_id', 'supplier', 'price_usd', 'checked_at'],
        filter: { variant_id: variantIds },
        error: getErrorDetails(error),
      });
    }

    const latestBySupplier = new Map<string, number>();
    for (const check of checks) {
      const key = `${check.variant_id}:${check.supplier}`;
      if (!latestBySupplier.has(key) && check.price_usd !== null) {
        latestBySupplier.set(key, Number(check.price_usd));
      }
    }

    const cheapestByVariant = new Map<string, number>();
    latestBySupplier.forEach((price, key) => {
      const variantId = key.slice(0, key.lastIndexOf(':'));
      const supplier = key.slice(key.lastIndexOf(':') + 1);
      if (variantId === 'v-s10-glo' && supplier !== 'eneba' && supplier !== 'g2a') return;
      cheapestByVariant.set(variantId, Math.min(cheapestByVariant.get(variantId) ?? Infinity, price));
    });

    const configuredPrices: Record<string, { final_usd: number; final_bs: number }> = {};
    let bcvRate: number | null = null;
    const configuredRows = pricingRows;
    for (const pricing of configuredRows) {
      if (
        (pricing.variant_id === 'v-s10-glo' || checksUnavailable)
        && pricing.final_price_usd !== null
        && pricing.final_price_bs !== null
        && (
          checksUnavailable
          || pricing.applied_margin_percent !== null
            && Number(pricing.applied_margin_percent) === Number(pricing.profit_margin_percent)
        )
      ) {
        configuredPrices[pricing.variant_id] = {
          final_usd: Number(pricing.final_price_usd),
          final_bs: Number(pricing.final_price_bs),
        };
      }
    }

    const priceRecords = configuredRows.map((pricing) => {
      if (configuredPrices[pricing.variant_id]) return null;
      if (pricing.variant_id === 'v-s10-glo') return null;
      const supplierCost = cheapestByVariant.get(pricing.variant_id) ?? Number(pricing.fallback_cost_usd);
      if (supplierCost === undefined || !Number.isFinite(supplierCost) || supplierCost <= 0) return null;
      const finalUsd = Number((supplierCost * (1 + Number(pricing.profit_margin_percent) / 100)).toFixed(2));
      return { variantId: pricing.variant_id, finalUsd };
    }).filter((record): record is { variantId: string; finalUsd: number } => record !== null);

    if (priceRecords.length > 0) {
      try {
        const rateResult = await refreshBcvRate();
        bcvRate = rateResult.rate;
      } catch (error) {
        warnings.push('No se pudo actualizar la tasa BCV; se omiten los precios que requieren un cálculo nuevo.');
        console.error('[api/product-prices][bcv] Falló la actualización de la tasa para calcular precios.', {
          error: getErrorDetails(error),
        });
      }
    }

    if (bcvRate !== null) {
      for (const price of priceRecords) {
        configuredPrices[price.variantId] = {
          final_usd: Number(price.finalUsd.toFixed(2)),
          final_bs: Math.ceil(price.finalUsd * bcvRate),
        };
      }
    }

    return NextResponse.json(
      { prices: configuredPrices, ...(warnings.length > 0 ? { warnings } : {}) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[api/product-prices] Error inesperado al cargar precios finales.', {
      error: getErrorDetails(error),
    });
    return NextResponse.json({ error: 'No se pudieron cargar los precios configurados.' }, { status: 500 });
  }
}
