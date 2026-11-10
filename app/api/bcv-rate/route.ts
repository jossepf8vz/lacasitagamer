import { NextResponse } from 'next/server';
import { refreshBcvRate } from '../../../lib/pricing/bcv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await refreshBcvRate();
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error al actualizar la tasa BCV oficial:', error);
    return NextResponse.json(
      {
        success: false,
        rate: null,
        error: error instanceof Error ? error.message : 'No se pudo consultar la tasa BCV.',
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
