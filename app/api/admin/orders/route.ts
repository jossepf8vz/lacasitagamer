import { NextResponse } from 'next/server';
import { getSupabaseServerClient, requireAdmin } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = { 'Cache-Control': 'no-store' };

type SaleRow = Record<string, unknown>;
type ApprovalBody = { id: string; status: 'aprobado' };
type DispatchBody = { id: string; status: 'completado'; variantId: string; deliveredKey: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isApprovalBody(value: unknown): value is ApprovalBody {
  return isRecord(value)
    && typeof value.id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id)
    && value.status === 'aprobado';
}

function isDispatchBody(value: unknown): value is DispatchBody {
  return isRecord(value)
    && typeof value.id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id)
    && value.status === 'completado'
    && typeof value.variantId === 'string'
    && /^[a-zA-Z0-9_-]{1,100}$/.test(value.variantId)
    && typeof value.deliveredKey === 'string'
    && value.deliveredKey.trim().length >= 3
    && value.deliveredKey.trim().length <= 1000;
}

function saleItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  const grouped = new Map<string, { name: string; variantId: string; gameId: string; priceUsd: number; quantity: number }>();
  for (const item of value) {
    if (!isRecord(item)
      || typeof item.name !== 'string'
      || typeof item.variantId !== 'string'
      || typeof item.gameId !== 'string') continue;
    const priceUsd = Number(item.priceUsd);
    const quantity = Number(item.quantity);
    if (!Number.isFinite(priceUsd) || !Number.isInteger(quantity) || quantity < 1) continue;
    const existing = grouped.get(item.variantId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      grouped.set(item.variantId, { name: item.name, variantId: item.variantId, gameId: item.gameId, priceUsd, quantity });
    }
  }
  return Array.from(grouped.values());
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
    const saleRowsByVariant = new Map(orderRows.map((row) => [String(row.variant_id), row]));
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
      status: orderRows.every((row) => row.status === 'completado')
        ? 'Completado'
        : orderRows.some((row) => row.status === 'aprobado' || row.status === 'completado')
          ? 'Pago verificado'
          : 'Pendiente',
      items: items.length > 0 ? items.map((item) => {
        const saleRow = saleRowsByVariant.get(item.variantId);
        return {
          ...item,
          status: String(saleRow?.status ?? 'pendiente'),
          deliveredKey: typeof saleRow?.delivered_key === 'string' ? saleRow.delivered_key : '',
        };
      }) : orderRows.map((row) => ({
        name: String(row.variant_id),
        variantId: String(row.variant_id),
        gameId: '',
        priceUsd: Number(row.total),
        quantity: 1,
        status: String(row.status ?? 'pendiente'),
        deliveredKey: typeof row.delivered_key === 'string' ? row.delivered_key : '',
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

  if (!isApprovalBody(body) && !isDispatchBody(body)) {
    return NextResponse.json({ error: 'La actualización de estado no es válida.' }, { status: 400, headers: noStoreHeaders });
  }

  try {
    const { user, error: authError } = await requireAdmin(request);
    if (!user) return NextResponse.json({ error: authError }, { status: 401, headers: noStoreHeaders });

    const supabase = getSupabaseServerClient();
    if (isApprovalBody(body)) {
      const { data, error } = await supabase
        .from('sales')
        .update({ status: 'aprobado', updated_at: new Date().toISOString() })
        .eq('order_id', body.id)
        .eq('status', 'pendiente')
        .select('*');

      if (error) throw error;
      if (!data?.length) return NextResponse.json({ error: 'No se encontró un pedido pendiente para verificar.' }, { status: 404, headers: noStoreHeaders });
      const { data: orderRows, error: readError } = await supabase.from('sales').select('*').eq('order_id', body.id);
      if (readError) throw readError;
      const [order] = await toAdminOrders((orderRows ?? []) as SaleRow[], supabase);
      return NextResponse.json({ order }, { headers: noStoreHeaders });
    }

    if (!isDispatchBody(body)) return NextResponse.json({ error: 'La clave de despacho no es válida.' }, { status: 400, headers: noStoreHeaders });

    const { data, error } = await supabase
      .from('sales')
      .update({
        status: 'completado',
        delivered_key: body.deliveredKey.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', body.id)
      .eq('variant_id', body.variantId)
      .eq('status', 'aprobado')
      .select('*');

    if (error) throw error;
    if (!data?.length) {
      return NextResponse.json(
        { error: 'No se encontró un ítem con el pago verificado o ya fue despachado.' },
        { status: 409, headers: noStoreHeaders }
      );
    }

    let realtimeNotified = false;
    const channel = supabase.channel(`order-delivery:${body.id}`);
    try {
      const result = await channel.send({
        type: 'broadcast',
        event: 'delivery-updated',
        payload: { orderId: body.id },
      });
      realtimeNotified = result === 'ok';
      if (!realtimeNotified) console.error('[api/admin/orders] Supabase Realtime no confirmó la notificación de despacho.', result);
    } catch (realtimeError) {
      console.error('[api/admin/orders] No se pudo emitir el evento Realtime de despacho.', realtimeError);
    } finally {
      await supabase.removeChannel(channel);
    }

    const { data: orderRows, error: readError } = await supabase.from('sales').select('*').eq('order_id', body.id);
    if (readError) throw readError;
    const [order] = await toAdminOrders((orderRows ?? []) as SaleRow[], supabase);
    return NextResponse.json({ order, realtimeNotified }, { headers: noStoreHeaders });
  } catch (error) {
    console.error('[api/admin/orders] No se pudo actualizar el estado del pedido.', error);
    return NextResponse.json({ error: 'No se pudo actualizar el pedido.' }, { status: 500, headers: noStoreHeaders });
  }
}
