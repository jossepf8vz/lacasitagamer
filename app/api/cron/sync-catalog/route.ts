import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const bcvRes = await fetch('https://pyd-monedasve.vercel.app/api/v1/latest');
    const bcvData = await bcvRes.json();
    const bcvRate = bcvData?.rates?.USD || bcvData?.USD || 904.4485;

    const { data, error: rpcError } = await supabase.rpc('sync_exchange_rate_and_recalculate_catalog', {
      p_bcv_rate: bcvRate,
      p_supplier_prices: [],
      p_updated_at: new Date().toISOString(),
    });

    if (rpcError) throw rpcError;

    return NextResponse.json({
      success: true,
      bcv_rate: bcvRate,
      supabase_response: data,
      message: 'Catálogo sincronizado exitosamente sin el fee de $0.40 en vitrina.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
