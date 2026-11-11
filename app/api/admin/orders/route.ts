import { NextResponse } from 'next/server';
import { getSupabaseServerClient, requireAdmin } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = { 'Cache-Control': 'no-store' };

async function toAdminOrder(order: Record<string, unknown>, supabase: ReturnType<typeof getSupabaseServerClient>) {
  const createdAt = String(order.created_at);
  let paymentProofUrl: string | null = null;
  if (typeof order.payment_proof_path === 'string' && order.payment_proof_path) {
    const { data, error } = await supabase.storage
      .from('payment-proofs')
      .createSignedUrl(order.payment_proof_path, 60 * 60);
    if (error) throw error;
    paymentProofUrl = data.signedUrl;
  }

  return {
    id: String(order.display_id),
    databaseId: String(order.id),
    date: new Intl.DateTimeFormat('es-VE').format(new Date(createdAt)),
    createdAt,
    customerEmail: String(order.customer_email),
    phone: String(order.customer_phone),
    paymentMethod: String(order.payment_method),
    bankName: String(order.payment_bank),
    referenceNumber: String(order.payment_reference),
    totalUsd: Number(order.total_usd),
    totalBs: Number(order.total_bs),
    status: order.status === 'aprobado' ? 'Aprobado' : 'Pendiente',
    items: order.items,
    paymentProofUrl,
  };
}

export async function GET(request: Request) {
  try {
    const { user, error: authError } = await requireAdmin(request);
    if (!user) return NextResponse.json({ error: authError }, { status: 401, headers: noStoreHeaders });

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    return NextResponse.json(
      { orders: await Promise.all((data ?? []).map((order) => toAdminOrder(order, supabase))) },
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
      .from('orders')
      .update({ status: 'aprobado', updated_at: new Date().toISOString() })
      .eq('id', body.id)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'No se encontró el pedido.' }, { status: 404, headers: noStoreHeaders });

    return NextResponse.json({ order: await toAdminOrder(data, supabase) }, { headers: noStoreHeaders });
  } catch (error) {
    console.error('[api/admin/orders] No se pudo actualizar el estado del pedido.', error);
    return NextResponse.json({ error: 'No se pudo actualizar el pedido.' }, { status: 500, headers: noStoreHeaders });
  }
}
