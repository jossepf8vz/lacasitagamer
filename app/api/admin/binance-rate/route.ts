import { NextResponse } from 'next/server';
import { refreshBinanceP2PRate } from '../../../../lib/pricing/binance';
import { getSupabaseServerClient, requireAdmin } from '../../../../lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { user, error: authError } = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('rate, updated_at')
      .eq('source', 'binance_p2p_usdt_ves')
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json(
      { rate: data ? Number(data.rate) : null, updatedAt: data?.updated_at ?? null },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Error al leer la tasa Binance guardada:', error);
    return NextResponse.json({ error: 'No se pudo leer la tasa Binance guardada.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { user, error: authError } = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: authError }, { status: 401 });

  try {
    const result = await refreshBinanceP2PRate();
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error al actualizar la tasa Binance P2P:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo actualizar la tasa Binance.' },
      { status: 502 }
    );
  }
}
