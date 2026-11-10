import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabase/server';

export const runtime = 'nodejs';

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

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('variants');
  const variantIds = Array.from(new Set((query ?? '').split(',').filter(Boolean)));
  if (variantIds.length === 0 || variantIds.length > 100 || variantIds.some((id) => !/^[a-zA-Z0-9_-]{1,100}$/.test(id))) {
    return NextResponse.json({ error: 'Se requiere una lista válida de 1 a 100 variantes.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const [{ data: pricingRows, error: pricingError }, { data: checks, error: checksError }] = await Promise.all([
      supabase
        .from('product_pricing')
        .select('variant_id, profit_margin_percent, fallback_cost_usd, final_price_usd, final_price_bs, applied_margin_percent')
        .in('variant_id', variantIds),
      supabase
        .from('supplier_price_checks')
        .select('variant_id, supplier, price_usd, checked_at')
        .in('variant_id', variantIds)
        .not('price_usd', 'is', null)
        .order('checked_at', { ascending: false }),
    ]);

    if (pricingError) throw pricingError;
    if (checksError) throw checksError;

    const latestBySupplier = new Map<string, number>();
    for (const check of checks as PriceCheckRow[]) {
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
    const configuredRows = pricingRows as PricingRow[];
    for (const pricing of configuredRows) {
      if (
        pricing.variant_id === 'v-s10-glo'
        && pricing.final_price_usd !== null
        && pricing.final_price_bs !== null
        && pricing.applied_margin_percent !== null
        && Number(pricing.applied_margin_percent) === Number(pricing.profit_margin_percent)
      ) {
        configuredPrices[pricing.variant_id] = {
          final_usd: Number(pricing.final_price_usd),
          final_bs: Number(pricing.final_price_bs),
        };
      }
    }

    const priceRecords = configuredRows.map((pricing) => {
      if (configuredPrices[pricing.variant_id]) return null;
      const supplierCost = pricing.variant_id === 'v-s10-glo'
        ? cheapestByVariant.get(pricing.variant_id)
        : cheapestByVariant.get(pricing.variant_id) ?? Number(pricing.fallback_cost_usd);
      if (supplierCost === undefined || !Number.isFinite(supplierCost) || supplierCost <= 0) return null;
      const finalUsd = Number((supplierCost * (1 + Number(pricing.profit_margin_percent) / 100)).toFixed(2));
      return { variantId: pricing.variant_id, finalUsd };
    }).filter((record): record is { variantId: string; finalUsd: number } => record !== null);

    if (priceRecords.length > 0) {
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
      bcvRate = rateData.promedio;
    }

    for (const price of priceRecords) {
      configuredPrices[price.variantId] = {
        final_usd: Number(price.finalUsd.toFixed(2)),
        final_bs: Math.ceil(price.finalUsd * bcvRate!),
      };
    }

    return NextResponse.json({ prices: configuredPrices }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error al cargar precios finales:', error);
    return NextResponse.json({ error: 'No se pudieron cargar los precios configurados.' }, { status: 500 });
  }
}
