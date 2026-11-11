import { NextResponse } from 'next/server';
import { getSupabaseServerClient, requireAdmin } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = { 'Cache-Control': 'no-store' };

type SaleRow = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function saleItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)
      || typeof item.name !== 'string'
      || typeof item.variantId !== 'string'
      || typeof item.gameId !== 'string') return [];
    const priceUsd = Number(item.priceUsd);
    const quantity = Number(item.quantity);
    if (!Number.isFinite(priceUsd) || !Number.isInteger(quantity) || quantity < 1) return [];
    return [{ name: item.name, variantId: item.variantId, gameId: item.gameId, priceUsd, quantity }];
  });
}

async function toAdminOrders(rows: SaleRow[], supabase: ReturnType<typeof getSupabaseServerClient>) {
  const grouped = new Map<string, SaleRow[]>();
  for (const row of rows) {
    const orderId = String(row.order_id);
    const group = grouped.get(orderId) ?? [];
    group.push(row);
    grouped.set(orderId, group);
  }

  return Promise.all(Array.from(grouped.entries()).map(async ([orderId, orderRows]) => {
    const order = orderRows[0];
    const customerInfo = isRecord(order.customer_info) ? order.customer_info : {};
    const createdAt = String(order.created_at);
    const items = saleItems(customerInfo.items);
    const totalUsd = Number(customerInfo.order_total);
    const totalBs = Number(customerInfo.total_bs);
    const paymentProofPath = customerInfo.payment_proof_path;
    let paymentProofUrl: string | null = null;
    if (typeof paymentProofPath === 'string' && paymentProofPath) {
      const { data, error } = await supabase.storage
        .from('payment-proofs')
        .createSignedUrl(paymentProofPath, 60 * 60);
      if (error) throw error;
      paymentProofUrl = data.signedUrl;
    }

    return {
      id: `LCG-${orderId.slice(0, 8).toUpperCase()}`,
      databaseId: orderId,
      date: new Intl.DateTimeFormat('es-VE').format(new Date(createdAt)),
      createdAt,
      customerEmail: String(customerInfo.email ?? ''),
      phone: String(customerInfo.phone ?? ''),
      paymentMethod: String(order.method),
      bankName: String(customerInfo.bank_name ?? ''),
      referenceNumber: String(order.reference),
      totalUsd: Number.isFinite(totalUsd) ? totalUsd : orderRows.reduce((sum, row) => sum + Number(row.total || 0), 0),
      totalBs: Number.isFinite(totalBs) ? totalBs : 0,
      status: orderRows.every((row) => row.status === 'aprobado') ? 'Aprobado' : 'Pendiente',
      items: items.length > 0 ? items : orderRows.map((row) => ({
        name: String(row.variant_id),
        variantId: String(row.variant_id),
        gameId: '',
        priceUsd: Number(row.total),
        quantity: 1,
      })),
      paymentProofUrl,
    };
  }));
}

export async function GET(request: Request) {
  try {
    const { user, error: authError } = await requireAdmin(request);
    if (!user) return NextResponse.json({ error: authError }, { status: 401, headers: noStoreHeaders });

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) throw error;

    return NextResponse.json(
      { orders: await toAdminOrders((data ?? []) as SaleRow[], supabase) },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error('[api/admin/orders] No se pudieron cargar los pedidos.', error);
    return NextResponse.json({ error: 'No se pudieron cargar los pedidos.' }, { status: 500, headers: noStoreHeaders });
  }
}

export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'El cuerpo debe ser JSON válido.' }, { status: 400, headers: noStoreHeaders });
  }

  if (
    typeof body !== 'object'
    || body === null
    || !('id' in body)
    || typeof body.id !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id)
    || !('status' in body)
    || body.status !== 'aprobado'
  ) {
    return NextResponse.json({ error: 'La actualización de estado no es válida.' }, { status: 400, headers: noStoreHeaders });
  }

  try {
    const { user, error: authError } = await requireAdmin(request);
    if (!user) return NextResponse.json({ error: authError }, { status: 401, headers: noStoreHeaders });

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('sales')
      .update({ status: 'aprobado', updated_at: new Date().toISOString() })
      .eq('order_id', body.id)
      .select('*');

    if (error) throw error;
    if (!data?.length) return NextResponse.json({ error: 'No se encontró el pedido.' }, { status: 404, headers: noStoreHeaders });

    const [order] = await toAdminOrders(data as SaleRow[], supabase);
    return NextResponse.json({ order }, { headers: noStoreHeaders });
  } catch (error) {
    console.error('[api/admin/orders] No se pudo actualizar el estado del pedido.', error);
    return NextResponse.json({ error: 'No se pudo actualizar el pedido.' }, { status: 500, headers: noStoreHeaders });
  }
}
