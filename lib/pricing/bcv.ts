import { getSupabaseServerClient } from '../supabase/server';

const MONTOSVE_RATES_URL = 'https://api.montosve.com/v1/fx/rates';
const BCV_RATE_SOURCE = 'bcv_official_ves';
const SOURCE_TIMEOUT_MS = 6000;
const BCV_RATE_CACHE_SECONDS = 12 * 60 * 60;
const BCV_RATE_CACHE_MS = BCV_RATE_CACHE_SECONDS * 1000;
const STEAM_VARIANT_ID = 'v-s10-glo';

type PricingRow = {
  variant_id: string;
  final_price_usd: number | string | null;
};

type StoredRate = {
  rate: number;
  updatedAt: string | null;
  source: string;
};

type PersistResult = {
  productPricingUpdated: number;
  exchangeRateUpdated: boolean;
  warnings: string[];
};

export async function refreshBcvRate() {
  const sourceErrors: string[] = [];
  let storedRate: StoredRate | null = null;
  let storedRateReadError: unknown = null;

  try {
    storedRate = await getStoredBcvRate();
    if (storedRate && isFreshStoredRate(storedRate)) {
      return {
        success: true as const,
        ...storedRate,
        bcv_rate: storedRate.rate,
        stale: false,
        persisted: true,
        cached: true,
      };
    }
  } catch (error) {
    storedRateReadError = error;
    console.error('[bcv][stored-rate] Falló la lectura de la tasa almacenada:', error);
  }

  try {
    const rate = await fetchMontosveRate(process.env.MONTOSVE_API_KEY || '');
    const persisted = await persistBcvRate(rate);
    return {
      success: true as const,
      rate,
      bcv_rate: rate,
      source: 'montosve.com',
      updatedAt: new Date().toISOString(),
      stale: false,
      persisted: persisted.exchangeRateUpdated,
      ...(persisted.warnings.length > 0 ? { warning: persisted.warnings.join(' ') } : {}),
    };
  } catch (error) {
    const message = errorMessage(error);
    sourceErrors.push(`MontosVE: ${message}`);
    console.error('Error fetching MontosVE:', error);
  }

  if (!storedRate) {
    try {
      storedRate = await getStoredBcvRate();
    } catch (error) {
      storedRateReadError = error;
      console.error('[bcv][stored-rate] Falló la lectura de la tasa de respaldo en Supabase:', error);
    }
  }

  if (storedRate) {
    console.warn(`[bcv][fallback:${storedRate.source}] Se usará la última tasa válida guardada.`);
    return {
      success: true as const,
      ...storedRate,
      bcv_rate: storedRate.rate,
      stale: true,
      persisted: true,
      warning: [
        'MontosVE no respondió; se devuelve la última tasa válida guardada en Supabase.',
        ...sourceErrors,
      ].join(' '),
    };
  }

  if (storedRateReadError) {
    throw new Error(
      `Fallaron las fuentes BCV (${sourceErrors.join('; ')}) y la lectura de Supabase (${errorMessage(storedRateReadError)}).`
    );
  }

  throw new Error(
    `Fallaron las fuentes BCV (${sourceErrors.join('; ')}) y no existe una tasa válida guardada en Supabase.`
  );
}

function isFreshStoredRate(storedRate: StoredRate) {
  if (!storedRate.updatedAt) return false;
  const updatedAt = Date.parse(storedRate.updatedAt);
  const age = Date.now() - updatedAt;
  return Number.isFinite(updatedAt) && age >= 0 && age < BCV_RATE_CACHE_MS;
}

export async function getStoredBcvRate(): Promise<StoredRate | null> {
  const supabase = getSupabaseServerClient();
  let pricingReadError: string | null = null;
  let exchangeRate: { rate: number | string; updated_at: string } | null = null;
  let currencyLookupError: string | null = null;

  try {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('rate, updated_at')
      .eq('currency', 'USD')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    exchangeRate = data;
  } catch (error) {
    currencyLookupError = errorMessage(error);
    console.warn(
      `[bcv][stored-rate:exchange_rates.currency] No se pudo consultar currency='USD'; se probará el esquema source: ${currencyLookupError}`
    );
  }

  if (!exchangeRate) {
    try {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('rate, updated_at')
        .eq('source', BCV_RATE_SOURCE)
        .maybeSingle();

      if (error) throw error;
      exchangeRate = data;
    } catch (error) {
      currencyLookupError = [
        currencyLookupError,
        `source: ${errorMessage(error)}`,
      ].filter(Boolean).join('; ');
    }
  }

  if (exchangeRate) {
    const rate = toValidRate(exchangeRate.rate);
    if (rate === null) {
      throw new Error('La tasa BCV guardada en exchange_rates no es válida.');
    }
    return {
      rate,
      updatedAt: exchangeRate.updated_at,
      source: 'supabase:exchange_rates',
    };
  }

  try {
    const { data: steamPricing, error: steamPricingError } = await supabase
      .from('product_pricing')
      .select('bcv_rate, updated_at')
      .eq('variant_id', STEAM_VARIANT_ID)
      .maybeSingle();

    if (steamPricingError) throw steamPricingError;
    const steamRate = toValidRate(steamPricing?.bcv_rate);
    if (steamRate !== null) {
      return {
        rate: steamRate,
        updatedAt: steamPricing.updated_at,
        source: 'supabase:product_pricing:v-s10-glo',
      };
    }
  } catch (error) {
    pricingReadError = errorMessage(error);
    console.warn(`[bcv][stored-rate:product_pricing] No se pudo leer el respaldo: ${pricingReadError}`);
  }

  throw new Error(
    `No existe tasa válida en exchange_rates (${currencyLookupError ?? 'sin fila'}); respaldo product_pricing (${pricingReadError ?? 'sin tasa válida'}).`
  );
}

export async function fetchMontosveRate(apiKey: string) {
  if (!apiKey) {
    throw new Error('Falta configurar MONTOSVE_API_KEY.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);

  try {
    const response = await fetch(MONTOSVE_RATES_URL, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'X-API-Key': apiKey,
        'Cache-Control': 'no-store',
      },
      signal: controller.signal,
    });
    const rawText = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawText);
    } catch (error) {
      throw new Error(`La respuesta no es JSON válido: ${errorMessage(error)}`);
    }

    const rate = extractMontosveBcvRate(payload);
    if (rate === null || rate < 1 || rate > 10000) {
      throw new Error('La respuesta JSON no contiene una tasa BCV/USD válida.');
    }
    return rate;
  } finally {
    clearTimeout(timeout);
  }
}

function extractMontosveBcvRate(payload: unknown): number | null {
  const root = asRecord(payload);
  if (root?.success === false || root?.ok === false) return null;

  const rates = Array.isArray(root?.data) ? root.data : [];
  const bcvUsdRate = rates.find((entry) => {
    const rate = asRecord(entry);
    return rate?.market === 'bcv'
      && typeof rate.currency_pair === 'string'
      && rate.currency_pair.toUpperCase() === 'USD/VES';
  });
  const rawRate = asRecord(bcvUsdRate)?.rate;
  const parsedRate = typeof rawRate === 'number'
    ? rawRate
    : typeof rawRate === 'string'
      ? Number(rawRate.trim().replace(',', '.'))
      : NaN;
  return Number.isFinite(parsedRate) && parsedRate >= 1 && parsedRate <= 10000
    ? parsedRate
    : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function toValidRate(value: unknown) {
  const rate = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseFloat(value.trim().replace(',', '.'))
      : NaN;
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

async function persistBcvRate(rate: number): Promise<PersistResult> {
  const warnings: string[] = [];
  let productPricingUpdated = 0;
  let exchangeRateUpdated = false;
  const updatedAt = new Date().toISOString();

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch (error) {
    const message = `No se pudo inicializar Supabase: ${errorMessage(error)}`;
    console.error(`[bcv][persist] ${message}`);
    return {
      productPricingUpdated,
      exchangeRateUpdated,
      warnings: [message],
    };
  }

  try {
    const { data: pricingRows, error: pricingError } = await supabase
      .from('product_pricing')
      .select('variant_id, final_price_usd');
    if (pricingError) throw pricingError;

    for (const row of (pricingRows ?? []) as PricingRow[]) {
      const finalPriceUsd = row.final_price_usd === null ? null : toValidRate(row.final_price_usd);
      const updates: { bcv_rate: number; final_price_bs?: number; updated_at: string } = {
        bcv_rate: rate,
        updated_at: updatedAt,
      };
      if (finalPriceUsd !== null) {
        updates.final_price_bs = Math.ceil(finalPriceUsd * rate);
      }

      const { error: updateError } = await supabase
        .from('product_pricing')
        .update(updates)
        .eq('variant_id', row.variant_id);
      if (updateError) {
        throw new Error(`${row.variant_id}: ${errorMessage(updateError)}`);
      }
      productPricingUpdated += 1;
    }
  } catch (error) {
    const message = `No se pudo actualizar product_pricing.bcv_rate/precio en Bs.: ${errorMessage(error)}`;
    warnings.push(message);
    console.error(`[bcv][persist:product_pricing] ${message}`);
  }

  try {
    const { error } = await supabase
      .from('exchange_rates')
      .upsert(
        { currency: 'USD', rate, updated_at: updatedAt },
        { onConflict: 'currency' }
      );
    if (error) throw error;
    exchangeRateUpdated = true;
  } catch (error) {
    const message = `No se pudo actualizar exchange_rates: ${errorMessage(error)}`;
    warnings.push(message);
    console.error(`[bcv][persist:exchange_rates] ${message}`);
  }

  return { productPricingUpdated, exchangeRateUpdated, warnings };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'error desconocido';
}
