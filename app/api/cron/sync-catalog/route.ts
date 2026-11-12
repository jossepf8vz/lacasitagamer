import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchSupplierPrice } from '../../../../lib/pricing/suppliers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30;

const ENEBA_CATALOG_PRODUCTS = [
  {
    variant_id: 'v-ps75-us',
    url: 'https://www.eneba.com/latam/psn-playstation-network-card-75-usd-usa-psn-key-united-states',
  },
  {
    variant_id: 'v-ps5-us',
    url: 'https://www.eneba.com/latam/psn-playstation-network-card-5-usd-usa-psn-key-united-states',
  },
] as const;

type SupplierPriceInput = {
  variant_id: string;
  cost_usd: number;
  supplier: 'eneba';
  seller_name: null;
  offer_url: string;
};

type SyncedSupplierPrice = {
  variant_id: string;
  current_cost_usd: number;
  final_price_usd: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBcvRate(value: unknown): number | null {
  const rate = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.trim().replace(',', '.'))
      : NaN;
  return Number.isFinite(rate) && rate >= 1 && rate <= 10000 ? rate : null;
}

function verifySyncedSupplierPrices(
  value: unknown,
  supplierPrices: SupplierPriceInput[]
): SyncedSupplierPrice[] {
  if (
    !isRecord(value)
    || value.success !== true
    || !Array.isArray(value.products)
  ) {
    throw new Error('Supabase no confirmó la sincronización de precios del catálogo.');
  }

  const products = value.products;
  return supplierPrices.map((supplierPrice) => {
    const syncedProduct = products.find((product) => (
      typeof product === 'object'
      && product !== null
      && !Array.isArray(product)
      && 'variant_id' in product
      && product.variant_id === supplierPrice.variant_id
    ));

    if (
      typeof syncedProduct !== 'object'
      || syncedProduct === null
      || !('best_price_usd' in syncedProduct)
      || typeof syncedProduct.best_price_usd !== 'number'
      || !('final_price_usd' in syncedProduct)
      || typeof syncedProduct.final_price_usd !== 'number'
    ) {
      throw new Error(`Supabase no devolvió los precios sincronizados para ${supplierPrice.variant_id}.`);
    }

    const marginMultiplier = supplierPrice.cost_usd < 20
      ? 1.33
      : supplierPrice.cost_usd < 50
        ? 1.20
        : 1.08;
    const expectedFinalUsd = Number((supplierPrice.cost_usd * marginMultiplier).toFixed(2));
    if (
      Math.round(syncedProduct.best_price_usd * 100) !== Math.round(supplierPrice.cost_usd * 100)
      || Math.round(syncedProduct.final_price_usd * 100) !== Math.round(expectedFinalUsd * 100)
    ) {
      throw new Error(`El precio confirmado por Supabase no coincide con el costo y margen esperados para ${supplierPrice.variant_id}.`);
    }

    return {
      variant_id: supplierPrice.variant_id,
      current_cost_usd: syncedProduct.best_price_usd,
      final_price_usd: syncedProduct.final_price_usd,
    };
  });
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

    const supplierPrices: SupplierPriceInput[] = await Promise.all(ENEBA_CATALOG_PRODUCTS.map(async (product) => {
      const costUsd = await fetchSupplierPrice({
        supplier: 'eneba',
        url: product.url,
      });

      return {
        variant_id: product.variant_id,
        cost_usd: costUsd,
        supplier: 'eneba',
        seller_name: null,
        offer_url: product.url,
      };
    }));

    const { data, error: rpcError } = await supabase.rpc('sync_exchange_rate_and_recalculate_catalog', {
      p_bcv_rate: bcvRate,
      p_supplier_prices: supplierPrices,
      p_updated_at: new Date().toISOString(),
    });

    if (rpcError) throw rpcError;
    const syncedSupplierPrices = verifySyncedSupplierPrices(data, supplierPrices);

    return NextResponse.json({
      success: true,
      bcv_rate: bcvRate,
      supabase_response: data,
      supplier_prices_synced: syncedSupplierPrices,
      message: 'Sincronización completada exitosamente sin el fee de $0.40 en vitrina.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
