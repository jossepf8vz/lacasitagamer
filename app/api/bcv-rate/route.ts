import { NextResponse } from 'next/server';
import { getStoredBcvRate } from '../../../lib/pricing/bcv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(_request: Request) {
  try {
    const storedRate = await getStoredBcvRate();
    const isPricingFallback = storedRate.source.includes('product_pricing');
    return NextResponse.json({
      success: true,
      rate: storedRate.rate,
      bcv_rate: storedRate.rate,
      source: storedRate.source,
      updatedAt: storedRate.updatedAt,
      stale: isPricingFallback,
      persisted: !isPricingFallback,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error al actualizar la tasa BCV oficial:', error);
    return NextResponse.json(
      {
        success: false,
        rate: null,
        bcv_rate: null,
        source: null,
        error: error instanceof Error ? error.message : 'No se pudo consultar la tasa BCV.',
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
