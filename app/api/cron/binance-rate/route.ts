import { NextResponse } from 'next/server';
import { refreshBinanceP2PRate } from '../../../../lib/pricing/binance';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const result = await refreshBinanceP2PRate();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error al actualizar la tasa Binance desde cron:', error);
    return NextResponse.json({ error: 'No se pudo actualizar la tasa Binance.' }, { status: 502 });
  }
}
