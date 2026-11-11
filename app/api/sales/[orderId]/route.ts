import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../../lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = { 'Cache-Control': 'no-store' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: { orderId: string } }) {
  if (!UUID_PATTERN.test(params.orderId)) {
    return NextResponse.json({ error: 'El identificador del pedido no es válido.' }, { status: 400, headers: noStoreHeaders });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('sales')
      .select('variant_id, status, delivered_key, customer_info')
      .eq('order_id', params.orderId);

    if (error) throw error;
    if (!data?.length) {
      return NextResponse.json({ error: 'No se encontró el pedido.' }, { status: 404, headers: noStoreHeaders });
    }

    const storedItems = data[0].customer_info
      && typeof data[0].customer_info === 'object'
      && !Array.isArray(data[0].customer_info)
      && 'items' in data[0].customer_info
      && Array.isArray(data[0].customer_info.items)
      ? data[0].customer_info.items
      : [];

    return NextResponse.json({
      items: data.map((item) => {
        const product = storedItems.find((stored) => (
          typeof stored === 'object'
          && stored !== null
          && 'variantId' in stored
          && stored.variantId === item.variant_id
        ));
        return {
          variantId: item.variant_id,
          name: typeof product === 'object' && product !== null && 'name' in product && typeof product.name === 'string'
            ? product.name
            : item.variant_id,
          status: item.status,
          deliveredKey: item.delivered_key,
        };
      }),
    }, { headers: noStoreHeaders });
  } catch (error) {
    console.error('[api/sales/:orderId] No se pudo consultar la entrega.', error);
    return NextResponse.json({ error: 'No se pudo consultar el estado del pedido.' }, { status: 500, headers: noStoreHeaders });
  }
}
