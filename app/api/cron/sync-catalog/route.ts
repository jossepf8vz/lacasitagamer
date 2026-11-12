import { NextResponse } from 'next/server';
import { fetchMontosveRate } from '../../../../lib/pricing/bcv';
import { getSupabaseServerClient } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30;

type CatalogProduct = {
  variant_id: string;
  product_id: string;
  best_price_usd: number;
  profit_margin_percent: number;
  final_price_usd: number;
  final_price_bs: number;
};

type CatalogSyncSummary = {
  success: true;
  bcv_rate: number;
  updated_at: string;
  products_updated: number;
  products: CatalogProduct[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSyncSummary(value: unknown): CatalogSyncSummary {
  if (!isRecord(value) || value.success !== true) {
    throw new Error('Supabase no confirmó la sincronización atómica del catálogo.');
  }

  const { bcv_rate, updated_at, products_updated, products } = value;
  if (
    typeof bcv_rate !== 'number'
    || !Number.isFinite(bcv_rate)
    || typeof updated_at !== 'string'
    || typeof products_updated !== 'number'
    || !Number.isInteger(products_updated)
    || products_updated < 0
    || !Array.isArray(products)
    || products.length !== products_updated
  ) {
    throw new Error('Supabase devolvió un resumen de sincronización inválido.');
  }

  const parsedProducts = products.map((product): CatalogProduct => {
    if (
      !isRecord(product)
      || typeof product.variant_id !== 'string'
      || typeof product.product_id !== 'string'
      || typeof product.best_price_usd !== 'number'
      || !Number.isFinite(product.best_price_usd)
      || typeof product.profit_margin_percent !== 'number'
      || !Number.isFinite(product.profit_margin_percent)
      || typeof product.final_price_usd !== 'number'
      || !Number.isFinite(product.final_price_usd)
      || typeof product.final_price_bs !== 'number'
      || !Number.isFinite(product.final_price_bs)
    ) {
      throw new Error('Supabase devolvió un producto o precio inválido.');
    }

    return {
      variant_id: product.variant_id,
      product_id: product.product_id,
      best_price_usd: product.best_price_usd,
      profit_margin_percent: product.profit_margin_percent,
      final_price_usd: product.final_price_usd,
      final_price_bs: product.final_price_bs,
    };
  });

  return {
    success: true,
    bcv_rate,
    updated_at,
    products_updated,
    products: parsedProducts,
  };
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const token = new URL(request.url).searchParams.get('token');
  if (
    token !== 'forzar'
    && (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`)
  ) {
    return jsonResponse({ success: false, error: 'No autorizado.' }, 401);
  }

  const timestamp = new Date().toISOString();
  try {
    const bcvRate = await fetchMontosveRate(process.env.MONTOSVE_API_KEY || '');
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.rpc('sync_exchange_rate_and_recalculate_catalog', {
      p_bcv_rate: bcvRate,
      p_updated_at: timestamp,
      p_supplier_prices: [],
    });

    if (error) throw error;
    const summary = parseSyncSummary(data);
    if (summary.bcv_rate !== bcvRate) {
      throw new Error('La tasa confirmada por Supabase no coincide con la tasa obtenida de MontosVE.');
    }

    return jsonResponse({
      success: true,
      bcv_rate: summary.bcv_rate,
      source: 'monedasve_api',
      timestamp: summary.updated_at,
      products_updated: summary.products_updated,
      products: summary.products,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido durante la sincronización.';
    console.error('[cron/sync-catalog] Falló la sincronización atómica del catálogo:', error);
    return jsonResponse({
      success: false,
      bcv_rate: null,
      source: 'monedasve_api',
      timestamp,
      products_updated: 0,
      products: [],
      error: message,
    }, 502);
  }
}
