import { getSupabaseServerClient } from '../supabase/server';

const BCV_OFFICIAL_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';
const BCV_RATE_SOURCE = 'bcv_official_ves';

type BcvResponse = {
  promedio?: unknown;
  price?: unknown;
};

export async function refreshBcvRate() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(BCV_OFFICIAL_URL, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`La API BCV respondió con el estado ${response.status}.`);
    }

    const data: unknown = await response.json();
    if (typeof data !== 'object' || data === null) {
      throw new Error('La API BCV no devolvió una tasa válida.');
    }

    const record = data as BcvResponse;
    const rawRate = record.promedio ?? record.price;
    const rate = typeof rawRate === 'number' || typeof rawRate === 'string' ? Number(rawRate) : NaN;
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('La API BCV no devolvió una tasa válida.');
    }

    const updatedAt = new Date().toISOString();
    const supabase = getSupabaseServerClient();
    const { data: savedRate, error } = await supabase
      .from('exchange_rates')
      .upsert(
        { source: BCV_RATE_SOURCE, rate, updated_at: updatedAt },
        { onConflict: 'source' }
      )
      .select('rate, updated_at')
      .single();

    if (error) throw error;
    return { rate: Number(savedRate.rate), updatedAt: savedRate.updated_at };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getStoredBcvRate() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('rate, updated_at')
    .eq('source', BCV_RATE_SOURCE)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const rate = Number(data.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('La tasa BCV guardada en Supabase no es válida.');
  }
  return { rate, updatedAt: data.updated_at };
}
