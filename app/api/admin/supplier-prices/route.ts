import { NextResponse } from 'next/server';
import { getSupabaseServerClient, requireAdmin } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = { 'Cache-Control': 'no-store' };

type SupplierPriceCheck = {
  variant_id: string;
  supplier: string;
  source_url: string;
  price_usd: number | null;
  final_price_usd: number | null;
  seller_name: string | null;
  offer_url: string | null;
  checked_at: string;
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'El cuerpo debe ser JSON válido.' }, { status: 400, headers: noStoreHeaders });
  }

  const variantIdsInput = body && typeof body === 'object' && 'variantIds' in body
    ? body.variantIds
    : null;
  if (
    !Array.isArray(variantIdsInput)
    || variantIdsInput.length === 0
    || variantIdsInput.length > 100
    || variantIdsInput.some((id) => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id))
  ) {
    return NextResponse.json({ error: 'Se requiere una lista válida de variantes.' }, { status: 400, headers: noStoreHeaders });
  }

  try {
    const { user, error: authError } = await requireAdmin(request);
    if (!user) return NextResponse.json({ error: authError }, { status: 401, headers: noStoreHeaders });

    const variantIds = Array.from(new Set(variantIdsInput as string[]));
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('supplier_price_checks')
      .select('variant_id, supplier, source_url, price_usd, final_price_usd, seller_name, offer_url, checked_at')
      .in('variant_id', variantIds)
      .order('checked_at', { ascending: false })
      .order('id', { ascending: false });

    if (error) throw error;

    const prices: Record<string, SupplierPriceCheck[]> = {};
    for (const check of (data ?? []) as SupplierPriceCheck[]) {
      const variantPrices = prices[check.variant_id] ?? [];
      if (variantPrices.some((price) => price.supplier === check.supplier)) continue;
      variantPrices.push(check);
      prices[check.variant_id] = variantPrices;
    }

    return NextResponse.json(
      { prices },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error('[api/admin/supplier-prices] No se pudieron cargar los precios de proveedores.', error);
    return NextResponse.json(
      { error: 'No se pudieron cargar los precios de proveedores.' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
