import { NextResponse } from 'next/server';
import { getStoredBcvRate, refreshBcvRate } from '../../../lib/pricing/bcv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await refreshBcvRate();
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error al actualizar la tasa BCV oficial:', error);
    try {
      const savedRate = await getStoredBcvRate();
      if (savedRate) {
        return NextResponse.json(
          { ...savedRate, stale: true, error: 'No se pudo actualizar la tasa; se devuelve la última guardada.' },
          { headers: { 'Cache-Control': 'no-store' } }
        );
      }
    } catch (storedRateError) {
      console.error('Error al leer la tasa BCV guardada:', storedRateError);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo consultar la tasa BCV.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
