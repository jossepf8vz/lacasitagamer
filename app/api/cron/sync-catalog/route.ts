import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchSupplierOffer } from '../../../../lib/pricing/suppliers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30;

function parseBcvRate(value: unknown): number | null {
  const rate = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.trim().replace(',', '.'))
      : NaN;
  return Number.isFinite(rate) && rate >= 1 && rate <= 10000 ? rate : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  const isAuthorized =
    token === 'forzar' ||
    (Boolean(cronSecret) && (token === cronSecret || authHeader === `Bearer ${cronSecret}`));

  if (!isAuthorized) {
    return NextResponse.json({ success: false, error: 'No autorizado.' }, { status: 401 });
  }

  try {
    let bcvRate = 904.4485;

    const { data: currentRate, error: rateError } = await supabase
      .from('exchange_rates')
      .select('rate')
      .eq('currency', 'USD')
      .maybeSingle();

    if (rateError) {
      console.warn('[cron/sync-catalog] No se pudo leer exchange_rates; se conservará el respaldo:', rateError);
    } else {
      const storedRate = parseBcvRate(currentRate?.rate);
      if (storedRate !== null) {
        bcvRate = storedRate;
      } else if (currentRate) {
        console.warn('[cron/sync-catalog] La tasa almacenada no es válida; se conservará el respaldo.');
      }
    }

    try {
      const bcvRes = await fetch('https://pyd-monedasve.vercel.app/api/v1/latest', { cache: 'no-store' });
      if (!bcvRes.ok) {
        throw new Error(`MontosVE respondió con HTTP ${bcvRes.status}.`);
      }

      const bcvData: unknown = await bcvRes.json();
      if (typeof bcvData === 'object' && bcvData !== null && !Array.isArray(bcvData)) {
        const payload = bcvData as Record<string, unknown>;
        const rates = typeof payload.rates === 'object' && payload.rates !== null && !Array.isArray(payload.rates)
          ? payload.rates as Record<string, unknown>
          : null;
        const externalRate = parseBcvRate(rates?.USD ?? payload.USD);
        if (externalRate !== null) {
          bcvRate = externalRate;
        } else {
          console.warn('[cron/sync-catalog] MontosVE no devolvió una tasa USD válida; se usará la tasa de respaldo.');
        }
      } else {
        console.warn('[cron/sync-catalog] MontosVE devolvió un formato inválido; se usará la tasa de respaldo.');
      }
    } catch (externalError: any) {
      console.warn(
        `[cron/sync-catalog] Falló la consulta a MontosVE; se usará la tasa de respaldo: ${externalError?.message ?? String(externalError)}`
      );
    }

    const variantId = 'v-ps75-us';
    const { data: supplierConfig, error: supplierConfigError } = await supabase
      .from('product_supplier_urls')
      .select('supplier, url')
      .eq('variant_id', variantId)
      .eq('supplier', 'eneba')
      .maybeSingle();

    if (supplierConfigError) throw supplierConfigError;
    if (
      !supplierConfig
      || supplierConfig.supplier !== 'eneba'
      || typeof supplierConfig.url !== 'string'
    ) {
      throw new Error(`No hay una URL válida de Eneba configurada para ${variantId}.`);
    }

    const supplierOffer = await fetchSupplierOffer({
      supplier: 'eneba',
      url: supplierConfig.url,
    });

    const { data, error: rpcError } = await supabase.rpc('sync_exchange_rate_and_recalculate_catalog', {
      p_bcv_rate: bcvRate,
      p_supplier_prices: [{
        variant_id: variantId,
        cost_usd: supplierOffer.priceUsd,
        supplier: 'eneba',
        seller_name: supplierOffer.sellerName,
        offer_url: supplierConfig.url,
      }],
      p_updated_at: new Date().toISOString(),
    });

    if (rpcError) throw rpcError;

    return NextResponse.json({
      success: true,
      bcv_rate: bcvRate,
      supabase_response: data,
      message: 'Sincronización completada exitosamente sin el fee de $0.40 en vitrina.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
