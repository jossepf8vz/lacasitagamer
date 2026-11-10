import { getSupabaseServerClient } from '../supabase/server';

const MONTOSVE_RATES_URL = 'https://api.montosve.com/v1/fx/rates';
const BCV_RATE_SOURCE = 'bcv_official_ves';
const SOURCE_TIMEOUT_MS = 6000;
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
  const apiKey = process.env.MONTOSVE_API_KEY;

  if (!apiKey) {
    sourceErrors.push('MontosVE: falta configurar MONTOSVE_API_KEY.');
    console.warn('[bcv][source:montosve] Falta configurar MONTOSVE_API_KEY.');
  } else {
    try {
      const rate = await fetchMontosveRate(apiKey);
      const persisted = await persistBcvRate(rate);
      if (!persisted.exchangeRateUpdated || persisted.productPricingUpdated === 0 || persisted.warnings.length > 0) {
        throw new Error(
          `No se pudo persistir la tasa nueva en ambas tablas: ${persisted.warnings.join(' ') || 'product_pricing no tiene filas configuradas.'}`
        );
      }
      return {
        success: true as const,
        rate,
        bcv_rate: rate,
        source: 'montosve',
        updatedAt: new Date().toISOString(),
        stale: false,
        persisted: true,
      };
    } catch (error) {
      const message = errorMessage(error);
      sourceErrors.push(`MontosVE: ${message}`);
      console.warn(`[bcv][source:montosve] No se pudo obtener/guardar la tasa: ${message}`);
    }
  }

  try {
    const storedRate = await getStoredBcvRate();
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
  } catch (error) {
    const message = errorMessage(error);
    console.error('[bcv][stored-rate] Falló la lectura de la tasa de respaldo en Supabase:', error);
    throw new Error(
      `Fallaron las fuentes BCV (${sourceErrors.join('; ')}) y la lectura de Supabase (${message}).`
    );
  }

  throw new Error(
    `Fallaron las fuentes BCV (${sourceErrors.join('; ')}) y no existe una tasa válida guardada en Supabase.`
  );
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

async function fetchMontosveRate(apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);

  try {
    const response = await fetch(MONTOSVE_RATES_URL, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'X-API-Key': apiKey,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const rate = extractMontosveBcvRate(await response.json());
    if (rate === null) {
      throw new Error('La respuesta JSON no contiene una tasa BCV/USD válida.');
    }
    return rate;
  } finally {
    clearTimeout(timeout);
  }
}

function extractMontosveBcvRate(payload: unknown): number | null {
  const root = asRecord(payload);
  if (!root || root.success === false || root.ok === false) return null;

  const prioritizedKeys = ['bcv', 'oficial', 'official', 'usd_ves_bcv', 'usd_bcv', 'bcv_usd'];
  for (const key of prioritizedKeys) {
    for (const candidate of findValuesByKey(payload, key)) {
      const directRate = toValidRate(candidate);
      if (directRate !== null) return directRate;
      const rate = extractRate(candidate, ['promedio', 'price', 'rate', 'value', 'valor', 'venta', 'tasa', 'usd']);
      if (rate !== null) return rate;
    }
  }

  return findUsdBcvRate(payload);
}

function findValuesByKey(value: unknown, targetKey: string): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => findValuesByKey(item, targetKey));
  }
  const record = asRecord(value);
  if (!record) return [];

  const candidates: unknown[] = [];
  for (const [key, nestedValue] of Object.entries(record)) {
    if (key.toLowerCase() === targetKey) candidates.push(nestedValue);
  }
  for (const nestedValue of Object.values(record)) {
    candidates.push(...findValuesByKey(nestedValue, targetKey));
  }
  return candidates;
}

function findUsdBcvRate(value: unknown): number | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const rate = findUsdBcvRate(item);
      if (rate !== null) return rate;
    }
    return null;
  }

  const record = asRecord(value);
  if (!record) return null;
  const labels = ['currency', 'code', 'symbol', 'market', 'source', 'name', 'type']
    .map((key) => record[key])
    .filter((entry): entry is string => typeof entry === 'string')
    .join(' ')
    .toLowerCase();
  if (/(usd|dolar|dólar)/i.test(labels) && /(bcv|oficial|official)/i.test(labels)) {
    const rate = extractRate(record, ['promedio', 'price', 'rate', 'value', 'valor', 'venta', 'tasa', 'usd']);
    if (rate !== null) return rate;
  }

  for (const nestedValue of Object.values(record)) {
    const rate = findUsdBcvRate(nestedValue);
    if (rate !== null) return rate;
  }
  return null;
}

function extractRate(value: unknown, rateKeys: readonly string[]): number | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const rate = extractRate(item, rateKeys);
      if (rate !== null) return rate;
    }
    return null;
  }

  if (typeof value !== 'object' || value === null) return null;
  const record = asRecord(value);
  if (!record) return null;

  for (const key of rateKeys) {
    if (key in record) {
      const rate = toValidRate(record[key]);
      if (rate !== null) return rate;
    }
  }
  for (const nestedValue of Object.values(record)) {
    const rate = extractRate(nestedValue, rateKeys);
    if (rate !== null) return rate;
  }
  return null;
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
      ? Number(value.replace(',', '.'))
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
        { source: BCV_RATE_SOURCE, rate, updated_at: updatedAt },
        { onConflict: 'source' }
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
