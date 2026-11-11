import { NextResponse } from 'next/server';
import { refreshBcvRate } from '../../../lib/pricing/bcv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(_request: Request) {
  try {
    const result = await refreshBcvRate();
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
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
