import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const responseHeaders = { 'Cache-Control': 'no-store' };

type PricingRow = {
  variant_id: string;
  [key: string]: unknown;
};

function pricesResponse(prices: Record<string, PricingRow>) {
  return NextResponse.json({ prices }, { headers: responseHeaders });
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('variants');
  const variantIds = Array.from(new Set((query ?? '').split(',').filter(Boolean)));

  if (
    variantIds.length === 0
    || variantIds.length > 100
    || variantIds.some((id) => !/^[a-zA-Z0-9_-]{1,100}$/.test(id))
  ) {
    return pricesResponse({});
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('product_pricing')
      .select('*')
      .in('variant_id', variantIds);

    if (error) throw error;

    const prices = (data ?? []).reduce<Record<string, PricingRow>>((result, item) => {
      result[item.variant_id] = item;
      return result;
    }, {});

    return pricesResponse(prices);
  } catch (error) {
    console.error('[api/product-prices] Error al cargar precios.', error);
    return pricesResponse({});
  }
}
