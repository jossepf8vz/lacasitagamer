import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = { 'Cache-Control': 'no-store' };

type OrderItemInput = {
  name: string;
  variantId: string;
  gameId: string;
  priceUsd: number;
  quantity: number;
};

const PAYMENT_PROOFS_BUCKET = 'payment-proofs';
const MAX_PAYMENT_PROOF_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_PAYMENT_PROOF_BYTES + 64 * 1024;
const PAYMENT_PROOF_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidImageSignature(fileType: string, bytes: Uint8Array) {
  if (fileType === 'image/png') {
    return bytes.length >= 8
      && bytes[0] === 0x89
      && bytes[1] === 0x50
      && bytes[2] === 0x4e
      && bytes[3] === 0x47
      && bytes[4] === 0x0d
      && bytes[5] === 0x0a
      && bytes[6] === 0x1a
      && bytes[7] === 0x0a;
  }
  if (fileType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return fileType === 'image/webp'
    && bytes.length >= 12
    && String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === 'RIFF'
    && String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === 'WEBP';
}

function orderResponse(order: Record<string, unknown>) {
  const createdAt = String(order.created_at);
  return {
    id: String(order.display_id),
    databaseId: String(order.id),
    date: new Intl.DateTimeFormat('es-VE').format(new Date(createdAt)),
    createdAt,
    customerEmail: order.customer_email,
    phone: order.customer_phone,
    paymentMethod: order.payment_method,
    bankName: order.payment_bank,
    referenceNumber: order.payment_reference,
    subtotalUsd: Number(order.subtotal_usd),
    discountUsd: Number(order.discount_usd),
    totalUsd: Number(order.total_usd),
    totalBs: Number(order.total_bs),
    status: order.status === 'aprobado' ? 'Aprobado' : 'Pendiente',
    items: order.items,
  };
}

function matchesOrderRequest(
  order: Record<string, unknown>,
  request: {
    email: string;
    phone: string;
    paymentMethod: string;
    bankName: string;
    referenceNumber: string;
    items: OrderItemInput[];
    discountUsd: number;
  }
) {
  const storedItems = Array.isArray(order.items)
    ? order.items.map((item) => {
      if (!isRecord(item)) return null;
      return {
        name: item.name,
        variantId: item.variantId,
        gameId: item.gameId,
        priceUsd: Number(item.priceUsd),
        quantity: Number(item.quantity),
      };
    })
    : [];
  const itemsMatch = storedItems.length === request.items.length
    && storedItems.every((item, index) => {
      const requested = request.items[index];
      return item !== null
        && item.name === requested.name
        && item.variantId === requested.variantId
        && item.gameId === requested.gameId
        && item.priceUsd === requested.priceUsd
        && item.quantity === requested.quantity;
    });

  return String(order.customer_email).toLowerCase() === request.email.trim().toLowerCase()
    && order.customer_phone === request.phone.trim()
    && order.payment_method === request.paymentMethod
    && order.payment_bank === request.bankName.trim()
    && order.payment_reference === request.referenceNumber.trim()
    && Number(order.discount_usd) === request.discountUsd
    && itemsMatch;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: 'El comprobante supera el tamaño máximo permitido.' }, { status: 413, headers: noStoreHeaders });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el formulario del pedido.' }, { status: 400, headers: noStoreHeaders });
  }

  const field = (name: string) => form.get(name);
  const email = field('email');
  const phone = field('phone');
  const paymentMethod = field('paymentMethod');
  const bankName = field('bankName');
  const referenceNumber = field('referenceNumber');
  const discountUsd = Number(field('discountUsd'));
  const bcvRate = Number(field('bcvRate'));
  const idempotencyKey = field('idempotencyKey');
  const itemsValue = field('items');
  const paymentProofValue = field('paymentProof');
  let items: unknown;
  try {
    if (typeof itemsValue !== 'string') throw new Error('missing items');
    items = JSON.parse(itemsValue);
  } catch {
    return NextResponse.json({ error: 'La lista de productos no es válida.' }, { status: 400, headers: noStoreHeaders });
  }

  const validItems = Array.isArray(items)
    && items.length > 0
    && items.length <= 20
    && items.every((item): item is OrderItemInput => isRecord(item)
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
  const emailIsValid = typeof email === 'string'
    && email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const phoneIsValid = typeof phone === 'string' && /^[+0-9()\-\s]{7,25}$/.test(phone.trim());
  const paymentIsValid = paymentMethod === 'pago_movil' || paymentMethod === 'binance';
  const bankIsValid = typeof bankName === 'string' && bankName.trim().length >= 2 && bankName.trim().length <= 100;
  const referenceIsValid = typeof referenceNumber === 'string'
    && /^[a-zA-Z0-9-]{3,80}$/.test(referenceNumber.trim());

  if (
    !emailIsValid
    || !phoneIsValid
    || !paymentIsValid
    || !bankIsValid
    || !referenceIsValid
    || !validItems
    || !Number.isFinite(discountUsd)
    || discountUsd < 0
    || !Number.isFinite(bcvRate)
    || bcvRate <= 0
    || typeof idempotencyKey !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)
    || typeof itemsValue !== 'string'
    || (paymentMethod === 'binance' && !(paymentProofValue instanceof File))
    || (paymentProofValue instanceof File && (
      !PAYMENT_PROOF_TYPES.has(paymentProofValue.type)
      || paymentProofValue.size <= 0
      || paymentProofValue.size > MAX_PAYMENT_PROOF_BYTES
    ))
  ) {
    return NextResponse.json({ error: 'Revisa los datos de contacto, pago y productos del pedido.' }, { status: 400, headers: noStoreHeaders });
  }

  const normalizedItems = (items as OrderItemInput[]).map((item) => ({
    name: item.name.trim(),
    variantId: item.variantId,
    gameId: item.gameId,
    priceUsd: Number(item.priceUsd.toFixed(2)),
    quantity: item.quantity,
  }));
  const subtotalUsd = Number(normalizedItems.reduce((sum, item) => sum + item.priceUsd * item.quantity, 0).toFixed(2));
  const normalizedDiscount = Number(discountUsd.toFixed(2));
  const totalUsd = Number((subtotalUsd - normalizedDiscount).toFixed(2));

  if (normalizedDiscount > subtotalUsd || totalUsd <= 0) {
    return NextResponse.json({ error: 'El descuento o el total del pedido no son válidos.' }, { status: 400, headers: noStoreHeaders });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data: existingOrder, error: existingError } = await supabase
      .from('orders')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingOrder) {
      if (!matchesOrderRequest(existingOrder, {
        email: email as string,
        phone: phone as string,
        paymentMethod: paymentMethod as string,
        bankName: bankName as string,
        referenceNumber: referenceNumber as string,
        items: normalizedItems,
        discountUsd: normalizedDiscount,
      })) {
        return NextResponse.json({ error: 'La clave del pedido ya fue utilizada.' }, { status: 409, headers: noStoreHeaders });
      }
      return NextResponse.json({ order: orderResponse(existingOrder) }, { headers: noStoreHeaders });
    }

    const variantIds = Array.from(new Set(normalizedItems.map((item) => item.variantId)));
    const { data: pricingRows, error: pricingError } = await supabase
      .from('product_pricing')
      .select('variant_id, final_price_usd')
      .in('variant_id', variantIds);
    if (pricingError) throw pricingError;

    const activePrices = new Map(
      (pricingRows ?? [])
        .filter((pricing) => pricing.final_price_usd !== null)
        .map((pricing) => [pricing.variant_id, Number(pricing.final_price_usd)])
    );
    const hasStalePrice = normalizedItems.some((item) => {
      const activePrice = activePrices.get(item.variantId);
      return activePrice !== undefined && item.priceUsd !== activePrice;
    });
    if (hasStalePrice) {
      return NextResponse.json(
        { error: 'El precio de uno de los productos cambió. Actualiza el catálogo e intenta de nuevo.' },
        { status: 409, headers: noStoreHeaders }
      );
    }

    let paymentProofPath: string | null = null;
    if (paymentProofValue instanceof File) {
      const proofBytes = new Uint8Array(await paymentProofValue.arrayBuffer());
      if (!isValidImageSignature(paymentProofValue.type, proofBytes)) {
        return NextResponse.json(
          { error: 'El archivo no contiene una imagen válida del tipo seleccionado.' },
          { status: 400, headers: noStoreHeaders }
        );
      }

      const extension = paymentProofValue.type === 'image/jpeg'
        ? 'jpg'
        : paymentProofValue.type === 'image/png' ? 'png' : 'webp';
      paymentProofPath = `${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(PAYMENT_PROOFS_BUCKET)
        .upload(paymentProofPath, proofBytes, {
          contentType: paymentProofValue.type,
          cacheControl: '0',
          upsert: false,
        });
      if (uploadError) throw uploadError;
    }

    const orderUuid = crypto.randomUUID();
    const displayId = `LCG-${orderUuid.slice(0, 8).toUpperCase()}`;
    const { data: createdOrder, error: insertError } = await supabase
      .from('orders')
      .insert({
        id: orderUuid,
        display_id: displayId,
        idempotency_key: idempotencyKey,
        customer_email: (email as string).trim().toLowerCase(),
        customer_phone: (phone as string).trim(),
        payment_method: paymentMethod,
        payment_bank: (bankName as string).trim(),
        payment_reference: (referenceNumber as string).trim(),
        payment_proof_path: paymentProofPath,
        items: normalizedItems,
        subtotal_usd: subtotalUsd,
        discount_usd: normalizedDiscount,
        total_usd: totalUsd,
        bcv_rate: Number(bcvRate.toFixed(4)),
        total_bs: Math.ceil(totalUsd * Number(bcvRate)),
        status: 'pendiente',
      })
      .select('*')
      .single();

    if (insertError) {
      if (paymentProofPath) {
        const { error: cleanupError } = await supabase.storage
          .from(PAYMENT_PROOFS_BUCKET)
          .remove([paymentProofPath]);
        if (cleanupError) {
          console.error('[api/orders] No se pudo limpiar el comprobante sin pedido asociado.', cleanupError);
        }
      }
    }

    if (insertError?.code === '23505') {
      const { data: concurrentOrder, error: concurrentReadError } = await supabase
        .from('orders')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (concurrentReadError) throw concurrentReadError;
      if (concurrentOrder && matchesOrderRequest(concurrentOrder, {
        email: email as string,
        phone: phone as string,
        paymentMethod: paymentMethod as string,
        bankName: bankName as string,
        referenceNumber: referenceNumber as string,
        items: normalizedItems,
        discountUsd: normalizedDiscount,
      })) {
        return NextResponse.json({ order: orderResponse(concurrentOrder) }, { headers: noStoreHeaders });
      }
    }
    if (insertError) throw insertError;

    return NextResponse.json({ order: orderResponse(createdOrder) }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    console.error('[api/orders] No se pudo registrar el pedido.', error);
    return NextResponse.json({ error: 'No se pudo registrar el pedido. No se generó ningún producto; intenta de nuevo.' }, { status: 500, headers: noStoreHeaders });
  }
}
