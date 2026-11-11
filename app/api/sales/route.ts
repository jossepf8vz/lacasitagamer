import { NextResponse } from 'next/server';
import { SERVICE_FEE_USD } from '../../../lib/pricing/constants';
import { getSupabaseServerClient } from '../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = { 'Cache-Control': 'no-store' };
const PAYMENT_PROOFS_BUCKET = 'payment-proofs';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

type SaleItem = {
  name: string;
  variantId: string;
  gameId: string;
  priceUsd: number;
  quantity: number;
};

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function itemsMatch(stored: unknown, requested: SaleItem[]) {
  if (!Array.isArray(stored) || stored.length !== requested.length) return false;
  return stored.every((value, index) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const item = value as Record<string, unknown>;
    const expected = requested[index];
    return item.name === expected.name
      && item.variantId === expected.variantId
      && item.gameId === expected.gameId
      && Number(item.priceUsd) === expected.priceUsd
      && Number(item.quantity) === expected.quantity;
  });
}

function isSameOrderRequest(rows: Array<Record<string, unknown>>, input: {
  email: string;
  name: string;
  phone: string;
  bankName: string;
  method: string;
  reference: string;
  items: SaleItem[];
  total: number;
}) {
  const first = rows[0];
  if (!first || first.method !== input.method || first.reference !== input.reference) return false;
  const customerInfo = first.customer_info;
  if (typeof customerInfo !== 'object' || customerInfo === null || Array.isArray(customerInfo)) return false;
  const info = customerInfo as Record<string, unknown>;
  return info.email === input.email.toLowerCase()
    && info.name === input.name
    && info.phone === input.phone
    && info.bank_name === input.bankName
    && Number(info.order_total) === input.total
    && itemsMatch(info.items, input.items);
}

function imageSignatureIsValid(type: string, bytes: Uint8Array) {
  if (type === 'image/png') {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50
      && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d
      && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return type === 'image/webp'
    && bytes.length >= 12
    && String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === 'RIFF'
    && String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === 'WEBP';
}

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  let authenticatedEmail: string | undefined;
  if (authorization) {
    if (!accessToken) {
      return NextResponse.json({ error: 'La sesión de cliente no es válida.' }, { status: 401, headers: noStoreHeaders });
    }

    try {
      const { data, error } = await getSupabaseServerClient().auth.getUser(accessToken);
      if (error || !data.user?.email) {
        return NextResponse.json({ error: 'La sesión de cliente no es válida o expiró.' }, { status: 401, headers: noStoreHeaders });
      }
      authenticatedEmail = data.user.email.toLowerCase();
    } catch (error) {
      console.error('[api/sales] No se pudo verificar la sesión del cliente.', error);
      return NextResponse.json({ error: 'No se pudo verificar tu sesión.' }, { status: 500, headers: noStoreHeaders });
    }
  }

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_FILE_BYTES + 64 * 1024) {
    return NextResponse.json({ error: 'El comprobante supera el tamaño máximo permitido.' }, { status: 413, headers: noStoreHeaders });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el formulario del pedido.' }, { status: 400, headers: noStoreHeaders });
  }

  const email = form.get('email');
  const name = form.get('name');
  const phone = form.get('phone');
  const method = form.get('paymentMethod');
  const bankName = form.get('bankName');
  const reference = form.get('referenceNumber');
  const orderId = form.get('idempotencyKey');
  const itemsValue = form.get('items');
  const discount = Number(form.get('discountUsd'));
  const bcvRate = Number(form.get('bcvRate'));
  const proof = form.get('paymentProof');
  let rawItems: unknown;

  try {
    if (typeof itemsValue !== 'string') throw new Error('missing items');
    rawItems = JSON.parse(itemsValue);
  } catch {
    return NextResponse.json({ error: 'Los productos del pedido no son válidos.' }, { status: 400, headers: noStoreHeaders });
  }

  const validItems = Array.isArray(rawItems)
    && rawItems.length > 0
    && rawItems.length <= 20
    && rawItems.every((item): item is SaleItem => typeof item === 'object'
      && item !== null
      && typeof item.name === 'string'
      && item.name.length > 0
      && item.name.length <= 200
      && typeof item.variantId === 'string'
      && /^[a-zA-Z0-9_-]{1,100}$/.test(item.variantId)
      && typeof item.gameId === 'string'
      && /^[a-zA-Z0-9_-]{1,100}$/.test(item.gameId)
      && typeof item.priceUsd === 'number'
      && Number.isFinite(item.priceUsd)
      && item.priceUsd > 0
      && item.priceUsd <= 10000
      && typeof item.quantity === 'number'
      && Number.isInteger(item.quantity)
      && item.quantity >= 1
      && item.quantity <= 25);
  const paymentIsValid = method === 'pago_movil' || method === 'binance';
  const proofIsValid = method !== 'binance' || proof instanceof File
    && ALLOWED_IMAGE_TYPES.has(proof.type)
    && proof.size > 0
    && proof.size <= MAX_FILE_BYTES;

  if (
    typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 120
    || typeof phone !== 'string' || !/^[+0-9()\-\s]{7,25}$/.test(phone.trim())
    || (authenticatedEmail !== undefined && typeof email === 'string' && email.trim().toLowerCase() !== authenticatedEmail)
    || !paymentIsValid
    || typeof bankName !== 'string' || bankName.trim().length < 2 || bankName.trim().length > 100
    || typeof reference !== 'string' || reference.trim().length < 3 || reference.trim().length > 80
    || !isUuid(orderId)
    || !validItems
    || !Number.isFinite(discount) || discount < 0
    || !Number.isFinite(bcvRate) || bcvRate <= 0
    || !proofIsValid
    || proof instanceof File && (!ALLOWED_IMAGE_TYPES.has(proof.type) || proof.size <= 0 || proof.size > MAX_FILE_BYTES)
  ) {
    return NextResponse.json({ error: 'Revisa tus datos, productos y comprobante de pago.' }, { status: 400, headers: noStoreHeaders });
  }

  const items = (rawItems as SaleItem[]).map((item) => ({ ...item, name: item.name.trim() }));
  const normalizedEmail = (email as string).trim().toLowerCase();
  const normalizedName = (name as string).trim();
  const normalizedPhone = (phone as string).trim();
  const normalizedBankName = (bankName as string).trim();
  const normalizedReference = (reference as string).trim();
  const subtotal = Number(items.reduce((sum, item) => sum + item.priceUsd * item.quantity, 0).toFixed(2));
  const total = Number((subtotal - discount + SERVICE_FEE_USD).toFixed(2));
  if (total <= 0 || discount > subtotal) {
    return NextResponse.json({ error: 'El total del pedido no es válido.' }, { status: 400, headers: noStoreHeaders });
  }

  let uploadedProofPath: string | null = null;
  let supabaseClient: ReturnType<typeof getSupabaseServerClient> | null = null;
  try {
    supabaseClient = getSupabaseServerClient();
    const supabase = supabaseClient;
    const { data: existing, error: existingError } = await supabase
      .from('sales')
      .select('*')
      .eq('order_id', orderId)
      .limit(1);
    if (existingError) throw existingError;
    if (existing?.length) {
      if (!isSameOrderRequest(existing as Array<Record<string, unknown>>, {
        email: normalizedEmail,
        name: normalizedName,
        phone: normalizedPhone,
        bankName: normalizedBankName,
        method: String(method),
        reference: normalizedReference,
        items,
        total,
      })) {
        return NextResponse.json({ error: 'El identificador del pedido ya fue utilizado para otra solicitud.' }, { status: 409, headers: noStoreHeaders });
      }
      return NextResponse.json({ orderId }, { headers: noStoreHeaders });
    }

    const variantIds = Array.from(new Set(items.map((item) => item.variantId)));
    const { data: priceRows, error: priceError } = await supabase
      .from('product_pricing')
      .select('variant_id, final_price_usd')
      .in('variant_id', variantIds);
    if (priceError) throw priceError;
    const activePrices = new Map((priceRows ?? [])
      .filter((row) => row.final_price_usd !== null)
      .map((row) => [row.variant_id, Number(row.final_price_usd)]));
    if (items.some((item) => {
      const currentPrice = activePrices.get(item.variantId);
      return currentPrice !== undefined && currentPrice !== Number(item.priceUsd.toFixed(2));
    })) {
      return NextResponse.json(
        { error: 'El precio de uno de los productos cambió. Actualiza el catálogo e intenta de nuevo.' },
        { status: 409, headers: noStoreHeaders }
      );
    }

    if (proof instanceof File) {
      const bytes = new Uint8Array(await proof.arrayBuffer());
      if (!imageSignatureIsValid(proof.type, bytes)) {
        return NextResponse.json({ error: 'El archivo no es una imagen válida.' }, { status: 400, headers: noStoreHeaders });
      }
      const extension = proof.type === 'image/jpeg' ? 'jpg' : proof.type === 'image/png' ? 'png' : 'webp';
      uploadedProofPath = `${orderId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(PAYMENT_PROOFS_BUCKET)
        .upload(uploadedProofPath, bytes, { contentType: proof.type, cacheControl: '0', upsert: false });
      if (uploadError) throw uploadError;
    }

    const customerInfo = {
      email: normalizedEmail,
      name: normalizedName,
      phone: normalizedPhone,
      bank_name: normalizedBankName,
      items,
      subtotal,
      discount,
      service_fee_usd: SERVICE_FEE_USD,
      order_total: total,
      bcv_rate: Number(bcvRate.toFixed(4)),
      total_bs: Number((total * bcvRate).toFixed(2)),
      payment_proof_path: uploadedProofPath,
    };
    const totalsByVariant = new Map<string, number>();
    for (const item of items) {
      totalsByVariant.set(item.variantId, (totalsByVariant.get(item.variantId) ?? 0) + item.priceUsd * item.quantity);
    }
    const salesRows = Array.from(totalsByVariant.entries()).map(([variantId, lineTotal]) => ({
      order_id: orderId,
      variant_id: variantId,
      total: Number(lineTotal.toFixed(2)),
      method,
      reference: normalizedReference,
      customer_info: customerInfo,
      status: 'pendiente',
    }));

    const { error: insertError } = await supabase.from('sales').insert(salesRows);
    if (insertError) {
      if (uploadedProofPath) {
        const { error: cleanupError } = await supabase.storage.from(PAYMENT_PROOFS_BUCKET).remove([uploadedProofPath]);
        if (cleanupError) console.error('[api/sales] Falló la limpieza de comprobante sin venta asociada.', cleanupError);
        uploadedProofPath = null;
      }
      if (insertError.code === '23505') {
        const { data: concurrent, error: concurrentError } = await supabase
          .from('sales')
          .select('*')
          .eq('order_id', orderId)
          .limit(1);
        if (concurrentError) throw concurrentError;
        if (concurrent?.length && isSameOrderRequest(concurrent as Array<Record<string, unknown>>, {
          email: normalizedEmail,
          name: normalizedName,
          phone: normalizedPhone,
          bankName: normalizedBankName,
          method: String(method),
          reference: normalizedReference,
          items,
          total,
        })) {
          return NextResponse.json({ orderId }, { headers: noStoreHeaders });
        }
      }
      throw insertError;
    }

    return NextResponse.json({ orderId }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    if (uploadedProofPath && supabaseClient) {
      const { error: cleanupError } = await supabaseClient.storage.from(PAYMENT_PROOFS_BUCKET).remove([uploadedProofPath]);
      if (cleanupError) console.error('[api/sales] Falló la limpieza de comprobante sin venta asociada.', cleanupError);
    }
    console.error('[api/sales] No se pudo insertar el pedido en sales.', error);
    return NextResponse.json(
      { error: 'No se pudo registrar el pedido. Verifica los datos e intenta de nuevo.' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
